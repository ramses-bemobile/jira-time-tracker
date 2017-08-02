document.addEventListener('DOMContentLoaded', onDOMContentLoaded, false);
var objectsToLog = {};
var projectStatuses = [];
var startAt = 0;
var totalResult = 0;
var maxResults = 10;
var pageIndex = 1;
var pageCount = 1;
var JIRA;
var Projects = '';

var baseUrl = '';

Date.prototype.toDateInputValue = (function () {
    var local = new Date(this);
    local.setMinutes(this.getMinutes() - this.getTimezoneOffset());
    return local.toJSON().slice(0, 10);
});

function onDOMContentLoaded() {

    chrome.storage.sync.get({
        username: '',
        password: '',
        baseUrl: '',
        apiExtension: '',
        jql: '',
        itemsOnPage: 10,
        projects: '',
        project: ''
    },
    init);
}

function init(options) {

    if (!options.username) {
        return errorMessage('Missing username');
    }
    if (!options.password) {
        return errorMessage('Missing password');
    }
    if (!options.baseUrl) {
        return errorMessage('Missing base URL');
    }
    if (!options.apiExtension) {
        return errorMessage('Missing API extension');
    }

    maxResults = !options.itemsOnPage ? 10 : options.itemsOnPage;

    JIRA = JiraAPI(options.baseUrl, options.apiExtension, options.username, options.password, options.jql);

    ShowProjectsDropDown(options.projects, options.project);

    $('div[id=loader-container]').toggle();

    $("#paging").on('click', "#next, #prev", function (evt) {
        var $self = $(this);
        var direction = $self.data("direction");
        if (pageIndex == 1 && direction == "prev" || direction == "next" && pageIndex == pageCount) {
            return false;
        }

        navigate($self, evt);
    });

    //get project statuses and after that load issues
    JIRA.getProjectStatuses($('#project-names').val(), ProjectStatuesSuccess, genericResponseError);

    baseUrl = options.baseUrl;
}

function onFetchSuccess(response) {
    var issues = response.issues;
    maxResults = response.maxResults;

    var total = response.total;
    var remains = total % maxResults;
    pageCount = (total - remains) / maxResults + 1;

    if (response.total > maxResults) {
        $("#paging").show();
    }
    else {
        $("#paging").hide();
    }

    $("#total_pages").text(pageCount);
    drawIssuesTable(issues);
    if (issues.length > 0) {
        JIRA.getTransitions(issues[0].key, onGetTransitionsSuccess, genericResponseError);
    }

    $('div[id=loader-container]').hide();

    issues.forEach(function (issue) {
        getWorklog(issue.key);
    });
}

function onFetchError(error) {
    $('div[id=loader-container]').hide();
    genericResponseError(error);
}

function drawIssuesTable(issues) {
    var $logTable = $('#jira-log-time-table');
    var $tbody = $logTable.children("tbody");
    $('#jira-log-time-table tbody tr').remove();
    LoadData();
    updateIcon();

    issues.forEach(function (issue) {
        var row = generateLogTableRow(issue.key, issue);
        row.appendTo($tbody);
    });
    $tbody.appendTo($logTable);
}

function getWorklog(issueId) {
    var $totalTime = $('div.issue-total-time-spent[data-total-issue-id=' + issueId + ']');
    var $loader = $totalTime.prev();

    $totalTime.hide();
    $loader.show();

    JIRA.getIssueWorklog(issueId, onWorklogFetchSuccess, onWorklogFetchError);

    function onWorklogFetchSuccess(response) {
        $totalTime.text(sumWorklogs(response.worklogs));
        $totalTime.show();
        $loader.hide();
        var $timeInput = $('input[data-time-issue-id=' + issueId + ']');
        $timeInput.val('');
    }

    function onWorklogFetchError(error) {
        $totalTime.show();
        $loader.hide();
        genericResponseError(error);
    }
}

function sumWorklogs(worklogs) {
    var totalSeconds = worklogs.reduce(function (a, b) {
        return { timeSpentSeconds: a.timeSpentSeconds + b.timeSpentSeconds }
    }, { timeSpentSeconds: 0 }).timeSpentSeconds;
    var totalWeeks = Math.floor(totalSeconds / 144000);
    totalSeconds = totalSeconds % 144000;
    var totalDays = Math.floor(totalSeconds / 28800);
    totalSeconds = totalSeconds % 28800;
    var totalHours = Math.floor(totalSeconds / 3600);
    totalSeconds = totalSeconds % 3600;
    var totalMinutes = Math.floor(totalSeconds / 60);
    return (totalWeeks ? totalWeeks + 'w' : '') + ' '
			+ (totalDays ? totalDays + 'd' : '') + ' '
			+ (totalHours ? totalHours + 'h' : '') + ' '
			+ (totalMinutes ? totalMinutes + 'm' : '');
}

function generateLogTableRow(id, summary) {
	var icon = buildHTML("img", null, {src:summary.fields.issuetype.iconUrl, style:"vertical-align:bottom"});
	
    var idCell = buildHTML('td', icon[0].outerHTML + id, { class: 'issue-id', 'data-id-issue-id': id });

    var summaryCell = buildHTML('td', summary.fields.summary, { class: 'issue-summary truncate', title: summary.fields.summary, 'data-summary-issue-id': id });

    var loader = buildHTML('div', null, { class: 'loader-mini', 'data-loader-issue-id': id });

    var totalTime = buildHTML('div', null, { class: 'issue-total-time-spent', 'data-total-issue-id': id });

    var totalTimeContainer = buildHTML('td', null, { class: 'total-time-container', 'data-ttcont-issue-id': id });

    totalTimeContainer.append(loader);
    totalTimeContainer.append(totalTime);


    // SECCION PARA GUARDAR HIDDEN EN LA TABLA 
    var hiddenStatus = buildHTML('input', null, { type: 'hidden', id: 'hidden-status-' + id, 'value': summary.fields.status.name });
    idCell.append(hiddenStatus);
    GetStatusesDropDown({ id: "hidden-select-status-" + id, style: "display: none;" }).appendTo(idCell);



    if (objectsToLog && !objectsToLog[id])
        objectsToLog[id] = {};

    var statusCell = buildHTML('td');
    statusCell.append(summary.fields.status.name);

    var row = buildHTML('tr', null, { 'data-row-issue-id': id, 'data-issue-id': id});
    row.on('click', selectIssueClickRow);


    if (objectsToLog[id] && objectsToLog[id].StartDate) {
        row.addClass("issueActiveRow");
    }


    row.append(idCell);
    row.append(summaryCell);
    row.append(totalTimeContainer);
    row.append(statusCell);
    return row;
}








function buildHTML(tag, html, attrs) {
    var $element = $("<" + tag + ">");
    if (html) 
		$element.html(html);

    for (attr in attrs) {
        if (attrs[attr] === false) continue;
        if (attr == "text") $element.text(attrs[attr]);
        if (attr == "value") $element.val(attrs[attr]);
        $element.attr(attr, attrs[attr]);
    }
    return $element;
}

function errorMessage(message) {
    var $error = $('#error');
    $error.text(message);
    $error.show();
}

function SaveData() {
    localStorage.setItem("objectsToLog", JSON.stringify(objectsToLog));
}

function LoadData() {
    objectsToLog = localStorage.objectsToLog ? JSON.parse(localStorage.objectsToLog) : {};
}


function GetStatusesDropDown(attr) {
    var $select = buildHTML("select", null, attr);

    for (var i in projectStatuses) {
        var itm = projectStatuses[i];
        var $option = buildHTML("option", null, { text: itm.text, value: itm.text, "data-transition-id": itm.id });
        $option.appendTo($select);
    }

    $($select.children()[0]).attr("selected", "selected");

    return $select;
}

function genericResponseError(error) {
    var response = error.response || '';
    var status = error.status || '';
    var statusText = error.statusText || '';

    if (response) {
        try {
            errorMessage(response.errorMessages.join(' '));
        } catch (e) {
            errorMessage('Error: ' + status + ' - ' + statusText);
        }
    } else {
        errorMessage('Error: ' + status + ' ' + statusText);
    }
}




function navigate(self, evt) {
    var direction = self.data("direction");

    if (direction == "next") {
        startAt = startAt + maxResults;
        JIRA.getIssues(startAt, maxResults, onFetchSuccess, onFetchError);
        pageIndex++;
    }

    if (direction == "prev") {
        startAt = startAt - maxResults;
        JIRA.getIssues(startAt, maxResults, onFetchSuccess, onFetchError);
        pageIndex--;
    }

    $("#page_number").text(pageIndex);
}

function ShowProjectsDropDown(projects, selectedProject) {
    var p = projects.split(',');
    var $projectsSelect = $('#project-names');
    var first;
    $(p).each(function (index, itm) {
        if (index == 0) first = itm;
        itm = itm.trim();
        var opt = buildHTML("option", null, { text: itm, value: itm });
        opt.appendTo($projectsSelect);
    });

    var val = "";
    if (selectedProject != null && selectedProject != "") {
        val = selectedProject;
    }
    else {
        val = first;
    }

    JIRA.setProject(val);
    $projectsSelect.val(val);
    $projectsSelect.change(ProjectSelectChange);
}

function ProjectSelectChange(evt) {
    var pname = $(this).val();

    chrome.storage.sync.set({
        project: pname
    });

    JIRA.setProject(pname);
    JIRA.getProjectStatuses(pname, ProjectStatuesSuccess, genericResponseError);
}

function ProjectStatuesSuccess(data) {
    projectStatuses = [];
    if ($.type(data) === "array" && data.length > 0) {
        var statuses = $.grep(data, function (e) { return e.name == "Task"; })[0].statuses;
        for (var i in statuses) {
            var status = statuses[i];
            projectStatuses.push({ id: status.id, text: status.name });
        }
    }
    else {
        projectStatuses = [
            { id: 11, text: "To Do" },
            { id: 21, text: "In Progress" },
            { id: 31, text: "Done" }
        ];
    }

    statusesInfoReady();

    JIRA.getIssues(startAt, maxResults, onFetchSuccess, onFetchError);
}

function onGetTransitionsSuccess(data) {
    projectStatuses = [];
    if (data != null) {
        var trans = data.transitions;
        for (var i in trans) {
            var itm = trans[i];
            $("select option[value='" + itm.name + "'").attr("data-transition-id", itm.id);
            projectStatuses.push({ id: itm.id, text: itm.name });
        }
    }
}

function updateIcon() {
    if (AnyTimerStarted())
        chrome.browserAction.setIcon({ path: "images/icon_run.png" });
    else
        chrome.browserAction.setIcon({ path: "images/icon.png" });
}

function AnyTimerStarted() {
    for (var key in objectsToLog) {
        if (objectsToLog[key] && objectsToLog[key].StartDate)
            return true;
    }
    return false;
}







/* * * * * * * * * * * * * * * * * * * * * 

Events Methods

* * * * * * * * * * * * * * * * * * * * */


function selectIssueClickRow(evt){

    var issueId = $(this).data('issue-id');
    selectIssueWithId(issueId);

    $(".issueSelected").removeClass("issueSelected");
    $(this).addClass("issueSelected");
}


function selectIssueWithId(issueId) {

    $("#issue_fields").show();

    errorMessage('');

    var summaryText = $('td[data-summary-issue-id=' + issueId + ']').html();
    var issueStatus = $('#hidden-status-' + issueId ).val();

    $('#issue_id').text(issueId);
    $('#issue_title').text(summaryText);


    // Borramos el html del select y el loader 
    $("#issue-status-div").html("");

    $('#input-time').val("");
    $('#input-comment').val("");


    // Agregamos el select haciedno un clon del de la tabla que est hidde
    var selectStatus = $( "#hidden-select-status-" + issueId ).clone();
    $("#issue-status-div").append(selectStatus);
    selectStatus.show();
    selectStatus.val(issueStatus);
    selectStatus.on('change', genericUpdateStatus);

    // Agregamos el loader 

    var statusLoaderDiv = buildHTML('div', null, { class: 'loader-mini', id: 'loader-mini' });
    statusLoaderDiv.hide();
    $("#issue-status-div").append(statusLoaderDiv);


    var newUrl = baseUrl + '/projects/' + $('#project-names').val() + "/issues/" + issueId;

    $("#issue_jira_url").attr('href', newUrl);


    if (objectsToLog[issueId] && objectsToLog[issueId].StartDate) {
        $("#input-play-stop").attr('src', 'images/stop.png'); 

        timerFrom("real-timer", objectsToLog[issueId].StartDate);

    }else{
        stopTimer();

        $("#input-play-stop").attr('src', 'images/play.png'); 
    }

    $('#input-save-loader').hide();

    $("#input-date").val(new Date().toDateInputValue());

}


function genericUpdateStatus(evt) {

    var self = $(this);
    var $div = $("#loader-mini");
    $div.show();
    $(this).hide();

    var id = $('#issue_id').text();
    var statusId = $(this).find(":selected").data("transition-id");

    JIRA.changeStatus(id, statusId, function (data) {
        self.show();
        $div.hide();
    }, genericResponseError); 

}

function genericPlayStop(evt){


    var $playStopButton = $("#input-play-stop");
    var action = $playStopButton.attr('src');

    var id = $('#issue_id').text();

    if (action.includes("play")){

        if (AnyTimerStarted()){
            errorMessage('Issue ejecutandose. Poner el id del issue aqui.');
        }else{
            $playStopButton.attr('src', 'images/stop.png'); 
            genericPlayButtonClick(id); 

            $('tr[data-row-issue-id=' + id + ']').addClass("issueActiveRow");
        }


    }else{
        $playStopButton.attr('src', 'images/play.png'); 

        genericStopButtonClick(id);

        $('tr[data-row-issue-id=' + id + ']').removeClass("issueActiveRow");

    }

}


function genericPlayButtonClick(issueId) {
    
    if (objectsToLog[issueId] && !objectsToLog[issueId].StartDate) {
        objectsToLog[issueId].StartDate = moment().format("YYYY-MM-DD HH:mm:ss");

        timerFrom("real-timer", objectsToLog[issueId].StartDate);
        SaveData();
    }

    updateIcon();
}

function genericStopButtonClick(issueId) {

    var $timeInput = $('#input-time');
    
    if (objectsToLog[issueId] && objectsToLog[issueId].StartDate) {


        stopTimer();
        
        
        var startDate = moment(objectsToLog[issueId].StartDate);
        var current = moment();
        var totalMinutes = current.diff(startDate, "minutes");

        var minutes = totalMinutes % 60;
        var hours = totalMinutes > minutes ? (totalMinutes - minutes) / 60 : 0;

        var text = (hours == 0 ? "" : hours + "h") + " " + minutes + "m";
        $timeInput.val(text);

        delete objectsToLog[issueId]["StartDate"];
        SaveData();
    }

    updateIcon();
}



function genericLogTimeClick(evt) {

    errorMessage('');

    var issueId = $('#issue_id').text();
    var timeInput = $('#input-time');
    var dateInput = $('#input-date');

    if (!timeInput.val().match(/[0-9]{1,4}[wdhm]/g)) {
        errorMessage('Time input in wrong format. You can specify a time unit after a time value "X", such as Xw, Xd, Xh or Xm, to represent weeks (w), days (d), hours (h) and minutes (m), respectively.');
        return;
    }

    var comment = $('#input-comment').val();
    if (comment != null && comment != "") {

        $('#input-save-loader').toggle();
        $('#input-save-log').toggle();


        JIRA.updateWorklog(issueId, timeInput.val(), new Date(dateInput.val()), comment,
        function (data) {
            getWorklog(issueId);

            $('#input-comment').val("");
            $('#input-time').val("");

            $('#input-save-loader').toggle();
            $('#input-save-log').toggle();

        }, genericResponseError);
    } else {
        //alert("time will not be logged. Check comment");
        
        errorMessage("time will not be logged. Check comment")
        getWorklog(issueId);
    }
}





/* * * * * * * * * * * * * * * * * * * * * 

Logic Methods 

* * * * * * * * * * * * * * * * * * * * */

function statusesInfoReady(){
    $("#input-play-stop").on('click', genericPlayStop);
    $("#input-save-log").on('click', genericLogTimeClick);
}



function infoReadyMethod(){

}


/* * * * * * * * * * * * * * * * * * * * * 

Connection Methods

* * * * * * * * * * * * * * * * * * * * */



/* * * * * * * * * * * * * * * * * * * * * 

Helpers 

* * * * * * * * * * * * * * * * * * * * */

var x;

function stopTimer(){
    clearInterval(x);
    $("#real-timer").text("");
}

function timerFrom(elementId, stringDate){

    // Set the date we're counting down to
//var countDownDate = new Date(stringDate).getTime();

var countStartDate = new Date(stringDate).getTime();


// Update the count down every 1 second
x = setInterval(function() {

  // Get todays date and time
  var now = new Date().getTime();

  // Find the distance between now an the count down date
  //var distance = countDownDate + now;

  var distance = now - countStartDate;

  // Time calculations for days, hours, minutes and seconds
  var days = Math.floor(distance / (1000 * 60 * 60 * 24));
  var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  var seconds = Math.floor((distance % (1000 * 60)) / 1000);

  // Display the result in the element with id="demo"
  document.getElementById(elementId).innerHTML = days + "d " + hours + "h "
  + minutes + "m " + seconds + "s ";

  // If the count down is finished, write some text 
  if (distance < 0) {
    clearInterval(x);
    document.getElementById(elementId).innerHTML = "EXPIRED";
  }
}, 1000);

}


















