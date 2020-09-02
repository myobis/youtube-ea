// Avoids errors and inappropriate behaviour when this script is executed in a non ytea page.
// The best in such situation, would be to avoid including it...
if (typeof ytVideoId !== 'undefined' && ytVideoId)

(function($){
const refreshProgressPeriod = 200;

const rxTimestampLine = /^\s*(.*?)(?:(?:\ |&nbsp;)*(?:(\d+)(?:\ |&nbsp;)*\:(?:\ |&nbsp;)*(\d{2})|(\d{1,2}))(?:\ |&nbsp;)*\:(?:\ |&nbsp;)*(\d{2}))(?:\s|&nbsp;)*(.*?)\s*$/mg;
const rxVideoSequence = /\[(?:\ *de\ *)?([^à\]]+)(?:à([^\]]+))?\]/gi;

function parseYoutubeChaptersFormat(ni)  {
    let struct = [];
    ni.replace(rxTimestampLine, function(fullMatch, prefix, hours, minutes1, minutes2, seconds, suffix) {
        let totalSeconds = 3600 * Number(hours || '0')  + 60 * Number(minutes1 || minutes2) + Number(seconds);
        let message = prefix + suffix;
        let timestamp = (hours ? hours + ':' : '') + (minutes1 || minutes2) + ":" + seconds;
        struct.push( {
            startTime : totalSeconds,
            jqTitle: $('<span class="timestamp" />').text(formatVideoTime(parseTimeEntryToVideoTime(timestamp)))
                .add($('<span class="title">').text(message))
        } );
    });
    return struct;
}

function getNavMarkup(allSections) {
    let navMarkup = $('<ul/>');
    for (let i=0; i<allSections.length; i++) {
        let section = allSections[i];
        let nextSectionStartTime =
            section.startTime > 0 && // Don't pause at the end of the introduction sequence
            i+1 < allSections.length ? allSections[i+1].startTime : 'false';
        navMarkup.append(
            $('<li class="future">')
                .attr('data-startTime', section.startTime)
                .append(
                    $('<a />')
                        .attr('href', 'javascript:seekToSequence(' + section.startTime + ', '+ nextSectionStartTime +' );')
                        .append(section.jqTitle)
                )
        );
    }
    return navMarkup;
}

function seekVideoAt(tStart, tEnd) {
    tStart = Number(tStart);
    stopReadingAt = tEnd || false;
    player.seekTo(tStart);
    player.playVideo();
}

let vtOnClock = -1;
function updateClockFromVideoTime(vt) {
    vt = Math.floor(vt);
    if (!timelineCalibration || vtOnClock === vt)
        return;
    vtOnClock = vt;
    let ct = videoTimeToClockTime(vt);
    $('#ytea-clock').html( formatClockTime(ct) ).show();
}

let knownProgressTs = -1;
function updateProgress(ts) {
    if ( !ts )
        ts = player.getCurrentTime();
    if (ts === knownProgressTs)
            return;
    knownProgressTs = ts;
    updateClockFromVideoTime(ts);
    switch (player.getPlayerState()) {
        case YT.PlayerState.PAUSED :
            updateUrlHash(ts);
            break;
        case YT.PlayerState.PLAYING:
            hideWelcomeMessage();
            if (stopReadingAt && ts >= stopReadingAt) {
                player.pauseVideo();
            }
            break;
    }

    var reverseLi = $($('#video-nav li').toArray().reverse());
    var tEnd = player.getDuration();
    reverseLi.each(function() {
        let li = $(this);
        let tStart = Number(li.attr('data-startTime'));
        if ( ts < tStart ) {
            li.addClass('future').removeClass('past current');
        } else if (ts >= tEnd) {
            li.addClass('past').removeClass('future current');
        } else {
            let sequenceDuration = tEnd - tStart;
            let chapterPercentage = 100 * (ts - tStart) / sequenceDuration;
            let isTitleChanging = ! li.is('.current');
            if (isTitleChanging) {
                li
                    .addClass('current').removeClass('past future');
                let currentTitleHtml = li.find('.title').html();
                $("#video-progress .sequence-title")
                    .html(currentTitleHtml)
                    .attr('data-sequenceDuration', sequenceDuration);
            }
            $('#video-progress .progress')
                .css('width', chapterPercentage+'%');
        }
        tEnd = tStart;
    });
}

function hideWelcomeMessage() {
    let seqInfo = $('#video-sequence-info');
    if (seqInfo.is(':visible')) {
        seqInfo.slideUp();
    }
}

let alreadyPlayed = false;
let stopReadingAt = false;
let progressionChecker;
function onPlayerStateChange(event) {
    switch (event.data) {
        case YT.PlayerState.PLAYING:
            if (!alreadyPlayed) {
                alreadyPlayed = true;
                progressionChecker = setInterval( updateProgress, refreshProgressPeriod );
            }
        break;
        case YT.PlayerState.PAUSED:
            stopReadingAt = false;
            updateUrlHash();
        break;
    }
}

var requestedStartTime = 0;
function onPlayerReady(event) {
    updateProgress( requestedStartTime );
}

function updateUrlHash(ts, te) {
    if ( ts === undefined )
        ts = player.getCurrentTime();
    document.location.hash= 'debut='+Math.floor(ts) + (te ? '&fin='+te : '');
}

function onClockClicked() {
    let wasPlaying = false;
    if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
        player.pauseVideo();
        wasPlaying = true;
    }
    setTimeout(function() {
        let currentDisplay = $('#ytea-clock').text();
        let requestedStartEntry = prompt('Où souhaitez-vous positionner la lecture ?\n  Exemples :\n- par heure "19h27:35" ou "19h30"\n- durée depuis le début de la vidéo : "1:03:55" ou "9:00"', currentDisplay);
        if (requestedStartEntry) {
            let requestedStart = parseTimeEntryToVideoTime(requestedStartEntry);
            if (requestedStart !== false) {
                seekToSequence( requestedStart, false );
                return;
            } else {
                alert("Format d'heure invalide.\nMerci de vous inspirer des exemples.");
            }
        }
        if (wasPlaying)
            player.playVideo();
    }, 1);
}

var player = false;
function resetYTPlayer(tStart, tEnd) {
    if (player)
        player.destroy();
    let videoParent = $('#video-parent').html('').append('<div id="video-placeholder" style="width: 100%" />');
    if (timelineCalibration) {
        videoParent.prepend(
            $('<div id="ytea-clock" style="display:none"></div>')
            .attr('title', $('#cm-page-title').text())
            .on('click', onClockClicked)
        );
    }
    requestedStartTime = tStart;
    stopReadingAt = tEnd || false;
    updateUrlHash(tStart, tEnd);
    player = new YT.Player('video-placeholder', {
        height: '390',
        width: '100%',
        videoId: ytVideoId,
        playerVars: {
            start: Number(tStart),
            rel:0
        },
        events: {
            onReady: onPlayerReady ,
            onStateChange: onPlayerStateChange
        }
    });
}

function seekToSequence(tStart, tEnd, letWelcomeMessage) {
    updateUrlHash(tStart, tEnd);
    if (letWelcomeMessage !== true)
		hideWelcomeMessage();
    if (alreadyPlayed) {
        seekVideoAt(tStart, tEnd);
    } else {
        resetYTPlayer(tStart, tEnd);
    }
}
window.seekToSequence = seekToSequence;

function getHashParam(name) {
    let h = location.hash || '';
    h = '&'+ (h[0] == '#' ? h.substr(1) : h) + '&';
    if ( (m = new RegExp("&"+name+"=([^&]*)&", 'i').exec(h)) != null) {
        return decodeURIComponent(m[1]);
    } else {
        return null;
    }
}
function getTStartFromUrlHash() {
    let ts = getHashParam('ts') || getHashParam('debut');
    return ts ? Number(ts) : null;
}
function getTEndFromUrlHash() {
    let te = getHashParam('te') || getHashParam('fin');
    return te ? Number(te) : null;
}

window.onYouTubeIframeAPIReady = function() { // Called by the YT lib once loaded
    let tInitialStart = getTStartFromUrlHash() || 0;
    let tInitialEnd = getTEndFromUrlHash() || false;
    if ( tInitialStart && tInitialEnd ) {
        let seqInfo = $('#video-sequence-info')
            .find('.duration')
                .text( formatDuration( tInitialEnd - tInitialStart ) )
            .end()
        .show();
        $([document.documentElement, document.body]).animate({
        scrollTop: seqInfo.offset().top
    }, 1000);
    }
    seekToSequence(tInitialStart, tInitialEnd, true);
}

function pad(num) {
    return ('00' + num).slice(-2);
}

function formatDuration(sec) {
    let hours = Math.floor(sec / 3600),
    minutes = Math.floor(sec / 60) % 60,
    seconds = sec % 60;
    return (hours>0 ? hours + 'h '+pad(minutes)+'m ' : minutes>0 ? minutes+'m ' : '') + (hours+minutes>0 ? pad(seconds) : seconds)+'s';
}
function formatClockTime(ct) {
    let hours = Math.floor(ct / 3600),
    minutes = Math.floor(ct / 60) % 60,
    seconds = ct % 60;
    return (hours>0 ? hours + 'h'+pad(minutes)+':' : minutes>0 ? minutes+':' : '') + (hours+minutes>0 ? pad(seconds) : seconds);
}

function addVideoSequenceLinks() {
    // Parse html and add Links to video sequences
    $('.wysiwyg').each(function() {
        let elt = $(this);
        let html = elt.html();
        if (!html)
            return;
        let htmlWithVideoLinks = html.replace(rxVideoSequence, function(fullMatch, sStartTime, sEndTime) {
            let startTime, endTime;
            // let endTime;
            rxTimestampLine.lastIndex = 0;
            if (match = rxTimestampLine.exec(sStartTime)) {
                let hours = match[2], minutes1 = match[3], minutes2 = match[4], seconds = match[5];
                startTime = 3600 * Number(hours || '0')  + 60 * Number(minutes1 || minutes2) + Number(seconds);
            } else {
                return fullMatch;
            }
            let durationInfo = '';
            if (sEndTime) {
                rxTimestampLine.lastIndex = 0;
                if (match = rxTimestampLine.exec(sEndTime)) {
                    let hours = match[2], minutes1 = match[3], minutes2 = match[4], seconds = match[5];
                    endTime = 3600 * Number(hours || '0')  + 60 * Number(minutes1 || minutes2) + Number(seconds);
                } else {
                    return fullMatch;
                }
                durationInfo = ' - '+ formatDuration(endTime - startTime);
            } else {
                endTime = false;
            }
            let reformattedStartTime = formatVideoTime(parseTimeEntryToVideoTime(sStartTime));
            let reformattedEndTime = formatVideoTime(parseTimeEntryToVideoTime(sEndTime));
            return ' <a class="link-to-video" title = "Voir cette séquence'+durationInfo+'" href="javascript:seekToSequence('+startTime+','+endTime+');">&#9654;&#65039;&nbsp;de '+reformattedStartTime+' à '+reformattedEndTime+'</a> ';
        });
        if (html !== htmlWithVideoLinks) {
            elt.html(htmlWithVideoLinks);
        }
    });
}

function registerSequenceTitleEvents() {
    $('#video-progress .sequence-title').click(function(e) {
        let titleElt = $(this);
        let parentOffset = titleElt.parent().offset();
        let relX = e.pageX - parentOffset.left;
        let tStart = Number($('li.current').attr('data-startTime'));
        let reStartTime = tStart + Number(titleElt.attr('data-sequenceDuration')) * relX / titleElt.outerWidth();
        seekToSequence(reStartTime, false);
    });
}

let timelineCalibration = false;
let rxParseCalibrationEntry=/^\s*(?:(\d{1,2})\s*:\s*)?(\d{1,2})\s*:\s*(\d{2})\s*=\s*(\d{1,2})\s*h\s*(\d{1,2})\s*m\s*(\d{1,2})\s*s?\s*$/i;
function initTimelineCalibration(config) {
    let entryList = config.split(';');
    let hasErrors = false;
    timelineCalibration = [];
    let entryInfo = false;
    for (let i=0; i<entryList.length; i++) {
        let entry = entryList[i];
        if (!entry) continue;
        let captures;
        if ((captures = rxParseCalibrationEntry.exec(entry))!== null) {
            let vtime = Number(captures[1]||'0')*3600 + Number(captures[2])*60 + Number(captures[3]);
            let clock = Number(captures[4])*3600 + Number(captures[5])*60 + Number(captures[6]); // On ne supporte pas actuellement le changement de journée
            if (entryInfo) {
                entryInfo.end = {
                    videoTime : vtime,
                    clockTime : entryInfo.start.clockTime + vtime - entryInfo.start.videoTime
                };
            }
            entryInfo = {
                start: { videoTime : vtime,    clockTime : clock },
                end: false
            };
            timelineCalibration.push( entryInfo );
        } else {
            console.error('***** Le format de l\'entrée de calibration "'+entry+'" est invalide.');
            hasErrors = true;
        }
    }
    // TODO : Make sure that the videoTime are sorted in ascending order
    if (hasErrors || timelineCalibration.length === 0) {
        timelineCalibration = false; // to avoid let thinking that it is ok
    }
}

let clockTimeToVideoTime_entry = false;
function clockTimeToVideoTime(ct) {
    if (!timelineCalibration) return false;
    if (
        ! clockTimeToVideoTime_entry
        || ( clockTimeToVideoTime_entry.end && ct > clockTimeToVideoTime_entry.end.clockTime)
        || ct < clockTimeToVideoTime_entry.start.clockTime
    ) {
        // Need to search for clockTimeToVideoTime_entry as this is not the latest used.
        // but it is possible that ct is not in any entry (video cuts) in this case, we want to return the videotime end of the previous sequence.
        let bestResult = 0;
        for (let i = 0; i < timelineCalibration.length; i++) {
            let entry = timelineCalibration[i];
            if (ct >= entry.start.clockTime) {
                bestResult = ct-entry.start.clockTime+entry.start.videoTime;
                if (entry.end && ct > entry.end.clockTime) {
                    bestResult = entry.end.videoTime; // we truncate... there may be a better result
                } else {
                    // we are exactly within the entry => this is the first matching result
                    clockTimeToVideoTime_entry = entry;
                    break;
                }
            }
        }
        return bestResult;
    } else {
        return ct - clockTimeToVideoTime_entry.start.clockTime + clockTimeToVideoTime_entry.start.videoTime;
    }
}

function formatVideoTime(vt) {
    if (!timelineCalibration) {
        return (vt>3600 ? Math.floor(vt/3600) +":" : "")
            + pad(Math.floor( vt%3600 / 60)) + ":"
            + pad(vt % 60);
    } else {
        let ct = videoTimeToClockTime(vt);
        return formatClockTime(ct);
    }
}

let rxParseClockTime=/^\s*(\d{1,2})\s*h\s*(\d{1,2})(?:m|\s*[m:]\s*(\d{1,2})\s*s?)?\s*$/i;
function parseTimeEntryToVideoTime(te) { // Works with both video time and clock time formats
    rxTimestampLine.lastIndex = 0;
    let match;
    if ((match = rxTimestampLine.exec(te)) && match[1] + match[6] === '') {
        let hours = match[2], minutes1 = match[3], minutes2 = match[4], seconds = match[5];
        return 3600 * Number(hours || '0')  + 60 * Number(minutes1 || minutes2) + Number(seconds);
    } else {
        if (match = rxParseClockTime.exec(te)) {
            let ct = Number(match[1])*3600 + Number(match[2])*60 + Number(match[3] || '0');
            return clockTimeToVideoTime(ct);
        }
        else {
            return false;
        }
    }
}

let videoTimetoClockTime_entry = false;
function videoTimeToClockTime(vt) {
    if (!timelineCalibration) return false;
    if (
        ! videoTimetoClockTime_entry
        || ( videoTimetoClockTime_entry.end && vt >= videoTimetoClockTime_entry.end.videoTime)
        || vt < videoTimetoClockTime_entry.start.videoTime
    ) {
        // Need to search for videoTimetoClockTime_entry as this is not the latest used.
        videoTimetoClockTime_entry = false;
        for (let i = 0; i < timelineCalibration.length; i++) {
            let entry = timelineCalibration[i];
            if (vt >= entry.start.videoTime) {
                if ( !entry.end || vt < entry.end.videoTime) {
                    videoTimetoClockTime_entry = entry;
                    break;
                }
            } else {
                break;
            }
        }
    }
    if (videoTimetoClockTime_entry) {
        return vt - videoTimetoClockTime_entry.start.videoTime + videoTimetoClockTime_entry.start.clockTime;
    } else {
        // vt must be before the 1st time
        return timelineCalibration[0].start.clockTime;
    }
}

$(function() {
    // Generate the Navigation UI
    $('#video-progress').show();
    let navElt = $('#video-nav');
    initTimelineCalibration(timelineCalibrationRaw);
    let navStructure = parseYoutubeChaptersFormat( navElt.html() );
    let navMarkup = getNavMarkup(navStructure);
    navElt
        .html('')
        .append(navMarkup);

        addVideoSequenceLinks();
    registerSequenceTitleEvents();
});

})(jQuery);