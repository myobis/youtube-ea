# Purpose of youtube-ea
This is a lib to embed a YouTube video in a page, then add some features to enhance the user experience and linking to the page with a specific sub-sequence.

# Genesis
This library was originally created to provide video and features for a wordpress template on [the website of "Ensemble Autrement"](https://ea2020.fr) where it was used in the context of the publication of municipal council. As some other villages expressed their wish to carry-out similar actions, we decided to share this code.
More details to come in the "Use Cases".

# Features
Typically eases the creation of CMS page templates focused on a single video, then bringing user experience enhancements and referencing capabilities.

## Video Embedding
The ytea lib will create a Youtube iframe player for the VideoId passed as a parameter.
This relies on the [YouTube Player API reference for iframe Embeds]((https://developers.google.com/youtube/iframe_api_reference)).

## Let YouTube count the views
Even if the Youtube Player would allow playing the video automatically, we don't do it at the very beginning because we want Youtube to count such a view.

Indeed, the documentation clearly states:
> Note: A playback only counts toward a video's official view count if it is initiated via a native play button in the player.

## Slicing into Chapters and progress bars
Similarly to [Youtube's Chapters](https://support.google.com/youtube/answer/9884579) ( that btw, don't display in an embedded YT player 😕), we reproduce a similar feature to ease the navigation:
The chapters are displayed below the player, and we have both *global* vertical and *chapter specific* horizontal progression bars. Clicking them seeks to a the corresponding chapter or position within a chapter.

This is an essential feature to let end users jump to the parts they are interested into.

## Progressive enhancement for internal sequence links
CMS authors can include formatted references to a specific video sequence in their texts. They will be parsed by the script and converted into actionable sequence links that will allow the end users to trigger it.

## Link to video sequences from the outside
One can copy/paste or build url link to a specific starting point, or video sequence to quote/reference a given sub-sequence.
When the url hash specified a subsequence (with start and end), the lib will scroll to the video position and display a welcome/information message that is supposed to state that the link suggests a sequence within a broader video.
Also, this message may be useful to inform the user that he is supposed to click onto the youtube link.

## Clock time management
If the parameter `timelineCalibrationRaw` is set, then the lib will display meaningful clock times instead of the elapsed time from the beginning of the video.
Also, a little clock is maintained at the top right corner of the yt video, and clicking on it allows to jump to a specifig clock time.

It functionally allows people attending to a recorded event, to write down the clock time of a given fact during the live event, in order to later find it directly (by clock time) in the online video.

# Usage

## Demo
See the test/demo.htm demo page.

## Dependencies
- jQuery (tested with 3.5.1 but might work with most of the versions)
- YouTube Player API for iframe Embeds ([reference](https://developers.google.com/youtube/iframe_api_reference)).

## Parameterization
The js lib basically takes 2 parameters that need to be set before the ytea.js lib is executed.

It is recommended to make these configurable from the administration of the CMS page.

As a rule of thumb, make sure that the values are properly escaped to be included in javascript code.

Example:
```
<script type="text/javascript">
	const ytVideoId = "0lBXAcrymFg";
	const timelineCalibrationRaw = "00:00=18h35m00s;27:14=19h05m26s";
</script>
```
Also, the free text in the video page can be considered as input data used by the lib as it will be parsed for linking, and to define the chapters.

### Javascript constant `ytVideoId`
This is the famous Youtube Video ID that can be found in the YT video url.

### Javascript constant `timelineCalibrationRaw`
This one is optional, and its presence triggers the feature of **Clock time management**.

If defined, it must be a semi colon ";" separated sequence of *videoTime=clockTime*
where *videoTime* format is in the youtube format like *mm:ss* or *hh:mm:ss*.

The first video time must be "00:00" to indicate the video start time. Each additional *videoTime=clockTime* indicated a cut/jump in clock time at he specified video time.

*NB: The video times must be ordered*

### Slicing into chapters
The lib will search for a HTML element with id **video-nav**.
Its content will be parsed and transformed into the interactive list of chapters.
The initial format that is supposed to be entered in the CMS admin page, is the one specified by YouTube for the chapters:
- 1 chapter per line, starting by a YouTube video timecode and followed by the chapter's label
- the timecode of the first chapter must be "00:00"

Then, the content of the **video-nav** element should be a copy/paste of the chapters definition from the YouTube video description.

### Format for video-sequence page internal links

The CMS authors can reference video subsequences from theur texts using the following format which will be recognized by the lib and converted into actionable links.

Only the texts under elements having class **wysiwyg** will be considered.

Format example: `[de 27:05 à 27:24]`

*NB: At this time we are using youtube timecodes here, clock times are not yet supported.*

## Expected Markup
Example :
```
<div id="video-sequence-info" style="display:none;">
	Bonjour &#x1F603;,<br/>Le lien que vous avez suivi pour arriver sur cette page, vous suggère une séquence de <span class="duration"></span>. Vous pouvez lancer sa lecture ci-dessous. Libre à vous de consulter aussi le contexte dans lequel elle s'inscrit.
</div>
<div id="video-parent"></div>
<div id="video-progress">
	<div class="progress"></div>
	<div class="sequence-title">&nbsp;</div>
</div>
<div id="video-nav">
	0:00 Titre et explications de la démarche de diffusion
	0:18 Une histoire de vestes
	4:25 Ouverture du Conseil Municipal
	(etc...)
</div>
```
### #video-sequence-info
This is the welcome/introduction text that is displayed iff landing here from an external link specifying a start and end timecode.
it can include a sub-element identified by class "duration" where the script will add the sub-sequence length.

### #video-parent
This is a placefolder element *within* which the lib will create the youtube player. #video-parent is typically NOT removed if the player has to be reset.

### #video-progress
Will welcome the horizontal progress bar, as well as a copy of the chapter label being read.

### #video-nav
Should initially contain the chapters definition in YouTube format.
This aims to be transformed into the interactive chapters list with the vertical progress bar.
