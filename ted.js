/**
 * TED Talks plugin for Movian Media Center
 *
 *  Copyright (C) 2015-2018 lprot
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var page = require('showtime/page');
var service = require('showtime/service');
var http = require('showtime/http');
var string = require('native/string');
var plugin = JSON.parse(Plugin.manifest);
var logo = Plugin.path + plugin.icon;

var BASE_URL = 'https://www.ted.com';
var category_name_bak = '';

RichText = function(x) {
    this.str = x.toString();
}

RichText.prototype.toRichString = function(x) {
    return this.str;
}

function setPageHeader(page, title) {
    if (page.metadata) {
        page.metadata.title = title;
        page.metadata.logo = logo;
    }
    page.type = "directory";
    page.contents = "items";
    page.loading = false;
}

var blue = '6699CC', orange = 'FFA500', red = 'EE0000', green = '008B45';
function coloredStr(str, color) {
    return '<font color="' + color + '">' + str + '</font>';
}

function trim(str) {
    return str.replace(/^\s+|\s+$/g,"");
}

service.create(plugin.title, plugin.id + ":start", 'video', true, logo);

function appendItem(page, url, title, description, icon) {

    var link = "videoparams:" + JSON.stringify({
        title: title,
        icon: icon,
        sources: [{
            url: url
        }],
        no_subtitle_scan: true
    });

    page.appendItem(link, "video", {
        title: new RichText(title),
        description: description,
        icon: icon,
        backdrops: [{url: icon}]
    });
}

new page.Route(plugin.id + ":talk:(.*):(.*)", function(page, link, title) {
    setPageHeader(page, decodeURIComponent(title));
    page.loading = true;
    var doc = http.request(BASE_URL + decodeURIComponent(link)).toString();
    page.loading = false;
    var json = JSON.parse(doc.match(/INITIAL_DATA__": ([\s\S]*?)\}\)/)[1]);

    appendItem(page,
        json.talks[0].player_talks[0].resources.hls.stream,
        decodeURIComponent(title),
        json.description,
        json.talks[0].player_talks[0].thumb);
});

function scraper(page, params) {
    var tryToSearch = first = true, param = '', pageNum = 1;
    page.entries = 0;
    var url = params;
    var total = 0;
    var category_name;

    category_name = params.substring(params.indexOf('='), params.length);
    if(category_name !== category_name_bak)
    {
        total = 0;
        category_name_bak = category_name;
    }

    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var doc = http.request(url + param).toString();

        page.loading = false;
        // 1-icon, 2-duration, 3-speaker, 4-link, 5-title, 6-posted, 7-rated
        var re = /<div class='media media--sm-v'>[\s\S]*?src="([\s\S]*?)"[\s\S]*?class="thumb__duration">([\s\S]*?)<\/span>[\s\S]*?speaker'>([\s\S]*?)<[\s\S]*?href='([\s\S]*?)'>([\s\S]*?)<\/a>[\s\S]*?<span class='meta__val'>([\s\S]*?)<\/span>([\s\S]*?)<\/div>/g;
        var match = re.exec(doc);
        if(null === match){
            appendItem(page, 'null', "No Content", "", "");
            return false;
        }

        while (match) {
            var genre = match[7].match(/<span class='meta__val'>([\s\S]*?)<\/span>/);
            total++;
            page.appendItem(plugin.id + ':talk:' + encodeURIComponent(match[4]) + ':' + encodeURIComponent(trim(match[5])), "directory", {
                title: string.entityDecode(match[3]) + ' - ' + string.entityDecode(trim(match[5])),
                icon: match[1],
                backdrops: [{url: match[1]}],
                duration: match[2],
                genre: (genre ? trim(genre[1]) : ''),
                tagline: string.entityDecode(trim(match[5])),
                source: new RichText('Posted: ' + trim(match[6])),
                extra_data: "total dynamic: " + total
            });
            page.entries++;
            match = re.exec(doc);
        }
        if (!doc.match(/rel="next"/))
            return tryToSearch = false;
        pageNum++;
        if (url.match(/\?/))
            param = '&page=' + pageNum;
        else
            param = '?page=' + pageNum;
        return true;
    }
    loader();
    page.paginator = loader;
    page.loading = false;
}

new page.Route(plugin.id + ":index:(.*):(.*)", function(page, sort, title) {
    setPageHeader(page, plugin.title + ' - Sorted by: ' + decodeURIComponent(title));
    scraper(page, BASE_URL + '/talks?sort=' + sort);
});

new page.Route(plugin.id + ":start", function(page) {
    setPageHeader(page, plugin.title + ' - Sort by:');
    page.appendItem(plugin.id + ":search:", 'search', {
        title: 'Search'
    });
    page.loading = true;
    var doc = http.request(BASE_URL + '/talks').toString();
    page.loading = false;
    doc = doc.match(/<optgroup label="Sort by([\s\S]*?)<\/optgroup>/)[1];
    // 1-uri component, 2-title
    var re = /<option value="([\s\S]*?)">([\s\S]*?)<\/option>/g;
    var match = re.exec(doc);
    while (match) {
        page.appendItem(plugin.id + ':index:' + match[1] + ':' + encodeURIComponent(match[2]), "directory", {
            title: match[2]
        });
        match = re.exec(doc);
    }
});

new page.Route(plugin.id + ":search:(.*)", function(page, query) {
    setPageHeader(page, plugin.title);
    scraper(page, BASE_URL + '/talks?q=' + encodeURIComponent(query));
});

page.Searcher(plugin.title, logo, function (page, query) {
    setPageHeader(page, plugin.title);
    scraper(page, BASE_URL + '/talks?q=' + encodeURIComponent(query));
});
