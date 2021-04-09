// Avoids errors and inappropriate behaviour when this script is executed in a non ytea page.
// The best in such situation, would be to avoid including it...
if (typeof ytVideoId !== 'undefined' && ytVideoId)

    (function() {
    const refreshProgressPeriod = 200;

    const rxTimestampLine = /^\s*(.*?)(?:(?:\ |&nbsp;)*(?:(\d+)(?:\ |&nbsp;)*\:(?:\ |&nbsp;)*(\d{2})|(\d{1,2}))(?:\ |&nbsp;)*\:(?:\ |&nbsp;)*(\d{2}))(?:\s|&nbsp;)*(.*?)\s*$/mg;
    const rxVideoSequence = /\[(?:\ *de\ *)?([^à\]]+)(?:à([^\]]+))?\]/gi;

    function parseYoutubeChaptersFormat(ni) {
        let struct = [];
        ni.replace(rxTimestampLine, function(fullMatch, prefix, hours, minutes1, minutes2, seconds, suffix) {
            let totalSeconds = 3600 * Number(hours || '0') + 60 * Number(minutes1 || minutes2) + Number(seconds);
            let message = prefix + suffix;
            let timestamp = (hours ? hours + ':' : '') + (minutes1 || minutes2) + ":" + seconds;
            // Timestamp DOM element.
            let elTimestamp = document.createElement("span");
            elTimestamp.className = "timestamp";
            elTimestamp.innerText = formatVideoTime(parseTimeEntryToVideoTime(timestamp));
            // Title DOM element.
            let elTitle = document.createElement("span");
            elTitle.className = "title";
            elTitle.innerText = message;
            struct.push({
                startTime: totalSeconds,
                elements: [elTimestamp, elTitle]
            });
        });

        return struct;
    }

    function getNavMarkup(allSections) {
        let navMarkup = document.createElement("ul");
        for (let i = 0; i < allSections.length; i++) {
            let section = allSections[i];
            let nextSectionStartTime =
                section.startTime > 0 && // Don't pause at the end of the introduction sequence
                i + 1 < allSections.length ? allSections[i + 1].startTime : 'false';
            let aElt = document.createElement("a");
            section.elements.forEach(function(childElt) { aElt.appendChild(childElt); });
            aElt.addEventListener("click", function(e) {
                seekToSequence(section.startTime, nextSectionStartTime);
            });
            aElt.setAttribute("href", "javascript://");
            let liElt = document.createElement("li");
            liElt.setAttribute("data-startTime", section.startTime);
            liElt.appendChild(aElt);
            navMarkup.appendChild(liElt);
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
        $('#ytea-clock').html(formatClockTime(ct)).show();
    }

    let knownProgressTs = -1;

    function updateProgress(ts) {
        if (!ts)
            ts = player.getCurrentTime();
        if (ts === knownProgressTs)
            return;
        knownProgressTs = ts;
        updateClockFromVideoTime(ts);
        switch (player.getPlayerState()) {
            case YT.PlayerState.PAUSED:
                updateUrlHash(ts);
                break;
            case YT.PlayerState.PLAYING:
                hideWelcomeMessage();
                if (stopReadingAt && ts >= stopReadingAt) {
                    player.pauseVideo();
                }
                break;
        }

        let liElts = document.querySelectorAll("#video-nav li");

        var tEnd = player.getDuration();
        for (let i = liElts.length - 1; i >= 0; i--) {
            let li = liElts[i];
            let tStart = Number(li.getAttribute('data-startTime'));
            if (ts < tStart) {
                li.classList.add("future");
                li.classList.remove("past", "current");
            } else if (ts >= tEnd) {
                li.classList.add("past");
                li.classList.remove("future", "current");
            } else {
                let sequenceDuration = tEnd - tStart;
                let chapterPercentage = 100 * (ts - tStart) / sequenceDuration;
                let isTitleChanging = !li.classList.contains("current");
                if (isTitleChanging) {
                    li.classList.add("current");
                    li.classList.remove("past", "future");
                    let currentTitleHtml = li.querySelector(".title").innerHTML;
                    let seqTitleElt = document.querySelector("#video-progress .sequence-title");
                    seqTitleElt.innerHTML = currentTitleHtml;
                    seqTitleElt.setAttribute("data-sequenceDuration", sequenceDuration);
                }
                let progressElt = document.querySelector('#video-progress .progress');
                progressElt.style.width = chapterPercentage + '%';
            }

            tEnd = tStart;
        }

    }

    function hideWelcomeMessage() {
        let seqInfo = document.getElementById('video-sequence-info');
        // TODO : Add class with css transition to hide if not in classList
        seqInfo.style.display = 'none';
    }

    let alreadyPlayed = false;
    let stopReadingAt = false;
    let progressionChecker;

    function onPlayerStateChange(event) {
        switch (event.data) {
            case YT.PlayerState.PLAYING:
                if (!alreadyPlayed) {
                    alreadyPlayed = true;
                    progressionChecker = setInterval(updateProgress, refreshProgressPeriod);
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
        updateProgress(requestedStartTime);
    }

    function updateUrlHash(ts, te) {
        if (ts === undefined)
            ts = player.getCurrentTime();
        document.location.hash = 'debut=' + Math.floor(ts) + (te ? '&fin=' + te : '');
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
                    seekToSequence(requestedStart, false);
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
        if (player) {
            player.destroy();
        }
        let placeholderElt = document.createElement("div");
        placeholderElt.setAttribute("id", "video-placeholder");
        placeholderElt.style.width = "100%";
        let videoParentElt = document.getElementById("video-parent");
        videoParentElt.innerHTML = "";

        if (timelineCalibration) {
            let clockElt = document.createElement("div");
            clockElt.setAttribute("id", "ytea-clock");
            clockElt.style.display = "none";
            clockElt.setAttribute("title", document.getElementById("cm-page-title").innerText);
            clockElt.addEventListener("click", onClockClicked);
            videoParent.appendChild(clockElt);
        }

        videoParentElt.appendChild(placeholderElt);

        requestedStartTime = tStart;
        stopReadingAt = tEnd || false;
        updateUrlHash(tStart, tEnd);
        player = new YT.Player('video-placeholder', {
            height: '390',
            width: '100%',
            videoId: ytVideoId,
            playerVars: {
                start: Number(tStart),
                rel: 0
            },
            events: {
                onReady: onPlayerReady,
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
        h = '&' + (h[0] == '#' ? h.substr(1) : h) + '&';
        if ((m = new RegExp("&" + name + "=([^&]*)&", 'i').exec(h)) != null) {
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
        if (tInitialStart && tInitialEnd) {
            let seqElt = document.getElementById("video-sequence-info");
            seqElt.querySelector(".duration").innerText = formatDuration(tInitialEnd - tInitialStart);
            seqElt.style.display = '';
            // TODO: animate scroll.
            window.scrollTo(0, seqElt.offsetTop - 10);
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
        return (hours > 0 ? hours + 'h ' + pad(minutes) + 'm ' : minutes > 0 ? minutes + 'm ' : '') + (hours + minutes > 0 ? pad(seconds) : seconds) + 's';
    }

    function formatClockTime(ct) {
        let hours = Math.floor(ct / 3600),
            minutes = Math.floor(ct / 60) % 60,
            seconds = ct % 60;
        return (hours > 0 ? hours + 'h' + pad(minutes) + ':' : minutes > 0 ? minutes + ':' : '') + (hours + minutes > 0 ? pad(seconds) : seconds);
    }

    function addVideoSequenceLinks() {
        // Parse html and add Links to video sequences
        let wElts = document.getElementsByClassName("wysiwyg");
        for (let i = 0, l = wElts.length; i < l; i++) {
            let elt = wElts[i];
            let html = elt.innerHTML;
            if (!html) { continue; }
            let htmlWithVideoLinks = html.replace(rxVideoSequence, function(fullMatch, sStartTime, sEndTime) {
                let startTime, endTime;
                // let endTime;
                rxTimestampLine.lastIndex = 0;
                if (match = rxTimestampLine.exec(sStartTime)) {
                    let hours = match[2],
                        minutes1 = match[3],
                        minutes2 = match[4],
                        seconds = match[5];
                    startTime = 3600 * Number(hours || '0') + 60 * Number(minutes1 || minutes2) + Number(seconds);
                } else {
                    return fullMatch;
                }
                let durationInfo = '';
                if (sEndTime) {
                    rxTimestampLine.lastIndex = 0;
                    if (match = rxTimestampLine.exec(sEndTime)) {
                        let hours = match[2],
                            minutes1 = match[3],
                            minutes2 = match[4],
                            seconds = match[5];
                        endTime = 3600 * Number(hours || '0') + 60 * Number(minutes1 || minutes2) + Number(seconds);
                    } else {
                        return fullMatch;
                    }
                    durationInfo = ' - ' + formatDuration(endTime - startTime);
                } else {
                    endTime = false;
                }
                let reformattedStartTime = formatVideoTime(parseTimeEntryToVideoTime(sStartTime));
                let reformattedEndTime = formatVideoTime(parseTimeEntryToVideoTime(sEndTime));
                return ' <a class="link-to-video" title = "Voir cette séquence' + durationInfo + '" href="javascript:seekToSequence(' + startTime + ',' + endTime + ');">&#9654;&#65039;&nbsp;de ' + reformattedStartTime + ' à ' + reformattedEndTime + '</a> ';
            });
            if (html !== htmlWithVideoLinks) {
                elt.innerHTML = htmlWithVideoLinks;
            }
        }
    }

    function registerSequenceTitleEvents() {
        let titleElt = document.querySelector("#video-progress .sequence-title");
        titleElt.addEventListener("click", function(e) {
            let parentOffset = titleElt.parentNode.getBoundingClientRect();
            let relX = e.pageX - parentOffset.left + document.body.scrollLeft;
            let tStart = document.querySelector("li.current").getAttribute("data-startTime");
            let reStartTime = Number(tStart) + Number(titleElt.getAttribute('data-sequenceDuration')) * relX / outerWidth(titleElt);
            seekToSequence(reStartTime, false);
        });
    }

    function outerWidth(el) {
        var width = el.offsetWidth;
        var style = getComputedStyle(el);

        width += parseInt(style.marginLeft) + parseInt(style.marginRight);
        return width;
    }
    let timelineCalibration = false;
    let rxParseCalibrationEntry = /^\s*(?:(\d{1,2})\s*:\s*)?(\d{1,2})\s*:\s*(\d{2})\s*=\s*(\d{1,2})\s*h\s*(\d{1,2})\s*m\s*(\d{1,2})\s*s?\s*$/i;

    function initTimelineCalibration(config) {
        let entryList = config.split(';');
        let hasErrors = false;
        timelineCalibration = [];
        let entryInfo = false;
        for (let i = 0; i < entryList.length; i++) {
            let entry = entryList[i];
            if (!entry) continue;
            let captures;
            if ((captures = rxParseCalibrationEntry.exec(entry)) !== null) {
                let vtime = Number(captures[1] || '0') * 3600 + Number(captures[2]) * 60 + Number(captures[3]);
                let clock = Number(captures[4]) * 3600 + Number(captures[5]) * 60 + Number(captures[6]); // On ne supporte pas actuellement le changement de journée
                if (entryInfo) {
                    entryInfo.end = {
                        videoTime: vtime,
                        clockTime: entryInfo.start.clockTime + vtime - entryInfo.start.videoTime
                    };
                }
                entryInfo = {
                    start: { videoTime: vtime, clockTime: clock },
                    end: false
                };
                timelineCalibration.push(entryInfo);
            } else {
                console.error('***** Le format de l\'entrée de calibration "' + entry + '" est invalide.');
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
        if (!clockTimeToVideoTime_entry ||
            (clockTimeToVideoTime_entry.end && ct > clockTimeToVideoTime_entry.end.clockTime) ||
            ct < clockTimeToVideoTime_entry.start.clockTime
        ) {
            // Need to search for clockTimeToVideoTime_entry as this is not the latest used.
            // but it is possible that ct is not in any entry (video cuts) in this case, we want to return the videotime end of the previous sequence.
            let bestResult = 0;
            for (let i = 0; i < timelineCalibration.length; i++) {
                let entry = timelineCalibration[i];
                if (ct >= entry.start.clockTime) {
                    bestResult = ct - entry.start.clockTime + entry.start.videoTime;
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
            return (vt > 3600 ? Math.floor(vt / 3600) + ":" : "") +
                pad(Math.floor(vt % 3600 / 60)) + ":" +
                pad(vt % 60);
        } else {
            let ct = videoTimeToClockTime(vt);
            return formatClockTime(ct);
        }
    }

    let rxParseClockTime = /^\s*(\d{1,2})\s*h\s*(\d{1,2})(?:m|\s*[m:]\s*(\d{1,2})\s*s?)?\s*$/i;

    function parseTimeEntryToVideoTime(te) { // Works with both video time and clock time formats
        rxTimestampLine.lastIndex = 0;
        let match;
        if ((match = rxTimestampLine.exec(te)) && match[1] + match[6] === '') {
            let hours = match[2],
                minutes1 = match[3],
                minutes2 = match[4],
                seconds = match[5];
            return 3600 * Number(hours || '0') + 60 * Number(minutes1 || minutes2) + Number(seconds);
        } else {
            if (match = rxParseClockTime.exec(te)) {
                let ct = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || '0');
                return clockTimeToVideoTime(ct);
            } else {
                return false;
            }
        }
    }

    let videoTimetoClockTime_entry = false;

    function videoTimeToClockTime(vt) {
        if (!timelineCalibration) return false;
        if (!videoTimetoClockTime_entry ||
            (videoTimetoClockTime_entry.end && vt >= videoTimetoClockTime_entry.end.videoTime) ||
            vt < videoTimetoClockTime_entry.start.videoTime
        ) {
            // Need to search for videoTimetoClockTime_entry as this is not the latest used.
            videoTimetoClockTime_entry = false;
            for (let i = 0; i < timelineCalibration.length; i++) {
                let entry = timelineCalibration[i];
                if (vt >= entry.start.videoTime) {
                    if (!entry.end || vt < entry.end.videoTime) {
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

    document.addEventListener('DOMContentLoaded', function() {
        // Generate the Navigation UI
        let progressElt = document.getElementById('video-progress');
        if (null !== progressElt) {
            progressElt.style.display = '';
        }

        if (typeof(timelineCalibrationRaw) !== "undefined") {
            initTimelineCalibration(timelineCalibrationRaw);
        }

        let navElt = document.getElementById('video-nav');
        if (null !== navElt) {
            let navStructure = parseYoutubeChaptersFormat(navElt.innerHTML);
            let navMarkup = getNavMarkup(navStructure);
            console.log(navMarkup);
            navElt.innerHTML = "";
            navElt.appendChild(navMarkup);
        }


        addVideoSequenceLinks();
        registerSequenceTitleEvents();
    });

})();