/**
 * Created by Phoenix on 2016/1/4.
 */
var KEY_SEQ = "SEQ";
var KEY_OP = "OPERATION";
var KEY_VAL = "VALUE";
var eventSeq = null;
var eventValue = null;
var eventResult = null;
var eventErrmsg = null;
var COMM_STANDBY  = 0,
    COMM_SENDING  = 1,
    COMM_FINISHED = 2;



function Communicator(socket) {
    var scope = this;

    this.time = 0;
    this.socket = socket;
    this.status = COMM_STANDBY;


    this.updateMissionList = function(waypoints){
        scope.waypointList = waypoints;
    };

    this.socket.onmessage = function (event) {
        console.log(event.data);
        var msg = JSON.parse(event.data);
        if (typeof (msg.SEQ) != 'undefined') {
            eventSeq = msg.SEQ;
            eventResult = msg.ERROR;
            eventValue = msg.VALUE;
            if (eventResult == "FAILURE"){
                eventErrmsg = msg.ERROR_MESSAGE;
            }
        }
        else{
            //Event update
            var state_string= "<div>"+
                    "State Update" + "<br>";

            if (typeof(msg.MISSION_TYPE) != 'undefined')
                state_string+=("CURR_STATE: " + msg.MISSION_TYPE+ "<br>");

            if (typeof(msg.TARGET_WAYPOINT) != 'undefined')
                state_string+=("TARGET_WAYPOINT: " + msg.TARGET_WAYPOINT+ "<br>");

            if (typeof(msg.IS_BROKEN) != 'undefined')
                state_string+=("IS_BROKEN: " + msg.IS_BROKEN+ "<br>");

            if (typeof(msg.LAST_MISSION_TYPE) != 'undefined')
                state_string+=( "LAST_MISSION_TYPE: " + msg.LAST_MISSION_TYPE + "<br>");

            if (typeof(msg.CURR_STATE) != 'undefined')
                state_string+=( "CURR_STATE: " + msg.CURR_STATE+ "<br>");

            if (typeof(msg.ERROR_NOTIFICATION) != 'undefined')
                state_string+=("ERROR_NOTIFICATION: " + msg.ERROR_NOTIFICATION + "<br>");

            if (typeof(msg.REASON) != 'undefined')
                state_string+=( "REASON: " + msg.REASON + "<br>");

            state_string+=("</div>");

            //No update if nothing happened
            if (event_string != "<div>State Update<br></div>")
                document.getElementById("state-update").innerHTML = state_string;

            //Event update
            var event_string = "<div>"+
                    "Event Update" + "<br>";

            if (typeof(msg.INCIDENT_TYPE) != 'undefined')
                event_string+=("INCIDENT_TYPE: " + msg.INCIDENT_TYPE+ "<br>");

            if (typeof(msg.WAYPOINT_INDEX) != 'undefined')
                event_string+=("WAYPOINT_INDEX: " + msg.WAYPOINT_INDEX+ "<br>");

            if (typeof(msg.CURR_STATE) != 'undefined')
                event_string+=("CURR_STATE: " + msg.CURR_STATE+ "<br>");

            if (typeof(msg.REPEAT) != 'undefined')
                event_string+=( "REPEAT: " + msg.REPEAT+ "<br>");

            event_string+=("</div>");

            //No update if nothing happened
            if (event_string != "<div>Event Update<br></kd")
                document.getElementById("event-update").innerHTML = event_string;

        }

    }

}

//Actually, only the upload waypoint list need an extra function to check whether done or not.
//As for others, they all can be handled in `onmessage`
//Need to refactor code in the same style, this `while` way, or the `onmessage` way.
//But need to test the delay problem in case of traffic jam and SEQ mess
//since ACK has no OPERATION
Communicator.prototype.checkDone = function(sequence) {
    var scope = this;
    /*
    0x00 --> success
    0x01 --> not success
    0x10 --> still waiting
    0x11 --> reserve
     */
    console.log (sequence + "," + eventSeq + "," + eventResult);
    if((sequence == eventSeq) && (eventResult == "SUCCESS")) {
        if (eventValue == null)
            //ACK
            return 0x00;
        else
            //cmd for get_xxx
            return eventValue;
    }
    else if ((sequence == eventSeq) && (eventResult != "SUCCESS")) {
        //throw errors
        //or some other way
        var errmsg = eventResult + "," + eventErrmsg;
        scope.resetCheckParam();
        alert("Command Failed with Error: " + errmsg);
        throw("Command Failed with Error: " + errmsg);
    }
    else
        return 0x10;
};

Communicator.prototype.resetCheckParam = function() {
    eventSeq = null;
    eventValue = null;
    eventResult = null;
    eventErrmsg = null;
};

//Following code needs to be refactored for a more general purpose;
Communicator.prototype.waitingACK= function(sequence) {
    var scope= this;
    setTimeout(
        function() {
            if (scope.time > 100){
                alert("timeout!, please try again!");
                scope.time = 0;
                return;
            }
            var doneFlag = scope.checkDone(sequence);
            console.log(doneFlag);
            if (doneFlag == 0x10) {
                console.log("Still Running");
                scope.time++;
                scope.waitingACK(sequence);
            }
            else if (doneFlag == 0x00) {
                alert("Command Success!");
                scope.time = 0;
            }

            else{
                scope.resetCheckParam();
                switch(doneFlag) {

                    default:
                        scope.time = 0;
                        break;
                }

            }
        }
    ,10);

};


Communicator.prototype.setNavigationMode = function() {
    //need to update sequence
    var sequence = "setNav";
    var newNavigationmode = set_navigation_mode;
    newNavigationmode.SEQ = sequence;
    this.socket.send(JSON.stringify(newNavigationmode));

    this.waitingACK(sequence);


};

Communicator.prototype.stopNavigationMode = function() {
    //need to update sequence
    var sequence = "setNav";
    var newNavigationmode = set_navigation_mode;
    newNavigationmode.SEQ = sequence;
    this.socket.send(JSON.stringify(newNavigationmode));

    this.waitingACK(sequence);


};

Communicator.prototype.uploadWayline= function() {
    var scope = this;

    if (scope.waypointList.length < 2){
        alert("Please set 2 waypoints at least!");
        return;
    }
    var sequence = "uploadWL";
    var newWayline = upload_mission_info;
    newWayline.SEQ = sequence;
    newWayline.VALUE.LENGTH = scope.waypointList.length;
    //TBD
    this.socket.send(JSON.stringify(newWayline));

    console.log(newWayline);

    waitWLUpload();


    function waitWLUpload() {
        var doneFlag = scope.checkDone(sequence);
        setTimeout(
            function() {
                if (doneFlag == 0x10){
                    console.log("Still Running");
                    waitWLUpload();
                }
                else if (doneFlag == 0x00){
                    console.log("Success");
                    scope.uploadWaypoint(0);
                }
                else{

                }
            }
        ,5);
    }


};

Communicator.prototype.downloadWayline= function() {
    var sequence =  "downloadWL";
    var downloadWayLine = download_waypoint_mission_info;

    downloadWayLine.SEQ = sequence;
    this.socket.send(JSON.stringify(downloadWayLine));
    this.waitingACK(sequence);
};

Communicator.prototype.uploadWaypoint = function(i) {
    var scope= this;

    if(i >= scope.waypointList.length)
        return;

    var sequence = "uploadWP"+i;
    var waypoint = updateWPData(sequence,i,scope.waypointList[i].latitude*Math.PI/180,scope.waypointList[i].longitude*Math.PI/180,scope.waypointList[i].altitude);
    this.socket.send(JSON.stringify(waypoint));

    waitWPUploadResult();


    function waitWPUploadResult() {
        var doneFlag = scope.checkDone(sequence);
        setTimeout(
            function() {
                if (doneFlag == 0x10){
                    console.log("Still Running");
                    waitWPUploadResult();
                }
                //The success will return successIndex, instead of 0x00 flag
                else{
                    console.log("Success");
                    scope.uploadWaypoint(i+1);
                }
            }
        ,5);
    }

};

Communicator.prototype.downloadWaypoint = function(index) {
    var sequence = "downloadWP";
    var downloadWP = download_waypoint;
    downloadWP.SEQ = sequence;
    downloadWP.VALUE.INDEX = index;

    this.socket.send(JSON.stringify(downloadWP));
    this.waitingACK(sequence);
};


Communicator.prototype.startWayline = function() {
    var sequence = "startMission";
    var startMission = startstop_waypoint_mission;

    startMission.SEQ = sequence;
    startMission.VALUE.GO_STOP = 0;

    this.socket.send(JSON.stringify(startMission));

    this.waitingACK(sequence);

};

Communicator.prototype.cancelWayline = function() {
    var sequence = "stopMission";
    var stopMission = startstop_waypoint_mission;

    stopMission.SEQ = sequence;
    stopMission.VALUE.GO_STOP = 1;

    this.socket.send(JSON.stringify(stopMission));

    this.waitingACK(sequence);


};

Communicator.prototype.pauseWayline = function() {
    var sequence = "pauseMission";
    var pauseMission = pauseresume_waypoint_mission;

    pauseMission.SEQ = sequence;
    pauseMission.VALUE.GO_STOP = 0;

    this.socket.send(JSON.stringify(pauseMission));

    this.waitingACK(sequence);

};

Communicator.prototype.continueWayline = function() {

    var sequence = "resumeMission";
    var continueMission = pauseresume_waypoint_mission;

    continueMission.SEQ = sequence;
    continueMission.VALUE.GO_STOP = 1;

    this.socket.send(JSON.stringify(continueMission));

};

Communicator.prototype.setWaylineIdleValue = function(idleValue) {

    var sequence = "setIdleValue";
    var setIdleValue = set_waypoint_idle_vel;

    setIdleValue.SEQ = sequence;
    setIdleValue.VALUE.IDLE_VEL= idleValue;

    this.socket.send(JSON.stringify(setIdleValue));
    this.waitingACK(sequence);

};

Communicator.prototype.getWaylineIdelValue = function() {

    var sequence = "getIdelValue";
    var getIdelValue = get_waypoint_idle_vel;

    getIdelValue.SEQ = sequence;

    this.socket.send(JSON.stringify(getIdelValue));
    this.waitingACK(sequence);

};
