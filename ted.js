
var http = require('showtime/http');
var page = require('showtime/page');
var string = require('native/string');

var channel_name_bak = '';

var PLUGIN_PREFIX = "ted:";
var BASE_URL = "https://www.ted.com";

(function(plugin){

    var service = plugin.createService("ted", PLUGIN_PREFIX + "start", "tv", true, "ted.bmp");

    // 添加视频分组
    plugin.addURI(PLUGIN_PREFIX + "start", function(page) {

        page.appendItem(PLUGIN_PREFIX + "search:", 'search', {title: 'Search'}); // 添加搜索栏

        var url = BASE_URL + "/talks";

        page.loading = true;
        var doc = http.request(url).toString();
        page.loading = false;

        doc = doc.match(/<optgroup label="Sort by([\s\S]*?)<\/optgroup>/)[1];
        // 1-uri component, 2-title
        var re = /<option value="([\s\S]*?)">([\s\S]*?)<\/option>/g;
        var match = re.exec(doc);
        while (match) {
            //print("\n---- group ----\n" + match[1] + "\n" + match[2] + "\n");
            page.appendItem(PLUGIN_PREFIX + 'channel_name:' + match[1], 'directory', {title: match[2]}); // 添加其他分组
            match = re.exec(doc);
        }

    });

    /******** 分组下的视频列表 ********/
    plugin.addURI(PLUGIN_PREFIX + "search:(.*)", function(page, search) { // 搜索组
        ted_refresh_page(page, search, "search");
    });

    plugin.addURI(PLUGIN_PREFIX + "channel_name:(.*)", function(page, channel_name) { //普通分组
        ted_refresh_page(page, channel_name, "group");
    });

    /******** 视频下的子列表 ********/
    plugin.addURI(PLUGIN_PREFIX + "video_info:(.*)", function(page, video_info) {

        var info = JSON.parse(video_info);
        // https://www.ted.com/talks/ramesh_raskar_a_camera_that_takes_one_trillion_frames_per_second
        var url = BASE_URL + info.video_id;
        print("\n[play window] " + url + "\n");

        page.loading = true;
        var doc = http.request(url).toString();
        page.loading = false;

        var play_url;
        var json = JSON.parse(doc.match(/INITIAL_DATA__": ([\s\S]*?)\}\)/)[1]);
        var description_str = "Title: " + info.title
                            + "\nSpeaker: " + info.speaker
                            + "\nDuration: " + info.duration
                            + "\nDate: " + info.date
                            + "\nViewers: " + info.viewers
                            + "\nDescription: " + json.description;
        var metadata = {
            icon: info.icon_url,
            description: description_str
        };

        if (json.talks[0].downloads.nativeDownloads) {
            play_url = json.talks[0].downloads.nativeDownloads.low;
            metadata.title = "low";
            page.appendItem(PLUGIN_PREFIX + "play_url:" + play_url, "video", metadata);

            play_url = json.talks[0].downloads.nativeDownloads.medium;
            metadata.title = "medium";
            page.appendItem(PLUGIN_PREFIX + "play_url:" + play_url, "video", metadata);

            play_url = json.talks[0].downloads.nativeDownloads.high;
            metadata.title = "high";
            page.appendItem(PLUGIN_PREFIX + "play_url:" + play_url, "video", metadata);
        }
        if (json.talks[0].player_talks[0].resources.h264) {
            play_url = json.talks[0].player_talks[0].resources.h264[0].file;
            metadata.title = "h264";
            page.appendItem(PLUGIN_PREFIX + "play_url:" + play_url, "video", metadata);
        }
        if (json.talks[0].player_talks[0].resources.hls) {
            play_url = json.talks[0].player_talks[0].resources.hls.stream;
            metadata.title = "m3u8";
            page.appendItem(PLUGIN_PREFIX + "play_url:" + play_url, "video", metadata);
        }

    });

    /******** 播放链接 ********/
    plugin.addURI(PLUGIN_PREFIX + "play_url:(.*)", function(page, play_url){

        var videoParams = {
            sources: [{
                url: play_url,
            }],
            no_subtitle_scan: true,
            subtitles: []
        }
        page.source = 'videoparams:' + JSON.stringify(videoParams);
    });

})(this);

function ted_refresh_page(page, channel_name, style_name) {
    var total = 0;
    var page_num = 0;

    if (channel_name != channel_name_bak) {
        total = 0;
        channel_name_bak = channel_name;
    }

    function loader() {
        page_num++;
        var url = "";
        if(style_name === "search") {
            // https://www.ted.com/talks?&q=man&page=1
            url = BASE_URL + "/talks" + "?&q=" + channel_name + "&page=" + page_num;
        } else {
            // https://www.ted.com/talks?sort=newest&page=1
            url = BASE_URL + "/talks" + "?&sort=" + channel_name + "&page=" + page_num;
        }

        page.loading = true;
        var doc = http.request(url).toString();
        page.loading = false;

        // 1-play, 2-icon, 3-duration, 4-speaker, 5-link, 6-title, 7-date
        var re = /<div class='media media--sm-v'>[\s\S]*?play="([\s\S]*?)"[\s\S]*?src="([\s\S]*?)"[\s\S]*?class="thumb__duration">([\s\S]*?)<\/span>[\s\S]*?speaker'>([\s\S]*?)<[\s\S]*?href='([\s\S]*?)'>([\s\S]*?)<\/a>[\s\S]*?<span class='meta__val'>([\s\S]*?)<\/span>/g;
        var match = re.exec(doc);
        if(null === match) {
            page_num--;
            return false;
        }

        while (match) {
            total++;
            //print("\n---- video ----\n" + match[1] + "\n" + match[2] + "\n" + match[3] + "\n" + match[4] + "\n" + match[5] + "\n" + match[6] + "\n" + match[7] + "\n");
            var icon_url = match[2].match(/([\s\S]*?)quality=/)[1] + "quality=5&amp;w=50";
            //print("\n----icon_url----\n" + icon_url + "\n");
            var video_info = {
                video_id: match[5],
                title: string.entityDecode(trim(match[6])),
                icon_url: icon_url,
                speaker: string.entityDecode(trim(match[4])),
                viewers: match[1],
                duration: match[3],
                date: trim(match[7])
            };

            var metadata = {
                title: string.entityDecode(trim(match[6])),
                icon: icon_url,
                extra_data: "total dynamic:" + total
            };
            page.appendItem(PLUGIN_PREFIX + "video_info:" + JSON.stringify(video_info), "directory", metadata);
            match = re.exec(doc);
        }

        return true;
    }

    loader();
    page.paginator = loader;
}

function trim(str) {
    return str.replace(/^\s+|\s+$/g,"");
}
