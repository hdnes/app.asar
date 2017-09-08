/**
 * Created by Phoenix on 2016/1/4.
 * JSON object definition
 */


//GoundStation related
var set_navigation_mode = {
    "SEQ":       "null",
    "OPERATION": "SetNavigationMode",
    "VALUE":     {
        "NAVIGATION_MODE":   1         // 1: Enter    2: Exit
    }
};

var upload_mission_info = {
    "SEQ":  		"null",
    "OPERATION": 	"UploadWayLineMission",
    "VALUE": 	{
        "LENGTH": 			0,//# of points
        "VEL_CMD_RANGE": 	10,//velocity range from RC
        "IDLE_VEL": 		10,
        "ACTION_ON_FINISH": 0,
        "MISSION_EXEC_NUM": 1, //Mission execute times
        "YAW_MODE": 		0,
        "TRACE_MODE": 		0,
        "ACTION_ON_RC_LOST": 0,
        "GIMBAL_PITCH_MODE": 0,
        "HP_LATI": 			22.540091*Math.PI/180, //The home info should be set as the one in drone MCU
        "HP_LONTI": 		113.946593*Math.PI/180,
        "HP_ALTI": 			100
    }
};

var download_waypoint_mission_info = {
    "SEQ":       "null",
    "OPERATION": "DownloadWayLineMission"
};

var upload_waypoint = {
    "SEQ":       "null",
    "OPERATION": "UploadWayPoint",
    "VALUE":     {
        "INDEX": 			0,
        "LATI": 			0,
        "LONTI":			0,
        "ALTI": 			120,
        "DAMPING_DIS": 		180,
        "TGT_YAW": 			30,
        "TGT_GIMBAL_PITCH": -120,
        "TURN_MODE": 		0,
        "HAS_ACTION":  		0,
        "ACTION_TIME_LIMIT":50,
        "ACTION": {
            "ACTION_NUM": 	15,
            "ACTION_RPT": 	15,
            "COMMAND_LIST":	{
                "WP_ACTION_STAY": 200,
                "WP_ACTION_SIMPLE_SHOT": 1,
                "WP_ACTION_VIDEO_START": 1,
                "WP_ACTION_VIDEO_STOP": 1,
                "WP_ACTION_CRAFT_YAW": 200,
                "WP_ACTION_GIMBAL_YAW": 200,
                "WP_ACTION_GIMBAL_PITCH": 200
            }
        }

    }
};

var download_waypoint = {
    "SEQ":       "null",
    "OPERATION": "DownloadWayPoint",
    "VALUE":{
        "INDEX": 2
    }
};

var startstop_waypoint_mission = {
    "SEQ":       "null",
    "OPERATION": "StartOrCancelWayLineMission",
    "VALUE":  {
       "GO_STOP": 0    // 0: go    1: stop
    }
};

var pauseresume_waypoint_mission = {
    "SEQ":       "null",
    "OPERATION": "PauseOrContinueWayLineMission",
    "VALUE":  {
      "PAUSE": 0    // 0: pause    1: continue
    }
};

var set_waypoint_idle_vel = {
    "SEQ":       "null",
    "OPERATION": "SetWayLineFlightIdelValue",
    "VALUE":  {
        "IDLE_VEL": 0
    }
};

var get_waypoint_idle_vel = {
    "SEQ":       "null",
    "OPERATION": "GetWayLineFlightIdelValue",
};


var navigation_runnning_status_info = {
    "EVENT": "data_update",
    "OPERATION": "PushNavigationStatusInfo",
    "VALUE": {
        "MISSION_TYPE": 0,
        "TARGET_WAYPOINT": 10,
        "CURR_STATE": 0,
        "ERROR_NOTIFICATION": 0
    }
};

var navigation_mission_status_info = {
    "EVENT": "data_update",
    "OPERATION": "PushNavigationStatusInfo",
    "VALUE": {
        "MISSION_TYPE": 1,
        "LAST_MISSION_TYPE": 10,
        "IS_BROKEN": 0,
        "REASON": 0
    }
};

var navigation_runnning_event_info = {
    "EVENT": "data_update",
    "OPERATION": "PushNavigationEventInfo",
    "VALUE": {
        "INCIDENT_TYPE": 0,
        "WAYPOINT_INDEX": 0,
        "CURR_STATE": 0
    }
};

var navigation_mission_event_info = {
    "EVENT": "data_update",
    "OPERATION": "PushNavigationEventInfo",
    "VALUE": {
        "INCIDENT_TYPE": 1,
        "REPEAT": 0
    }
};
//update waypoint data
function updateWPData(seq, index, lati, longi, alti, damping_dis, tgt_yaw, tgt_gimbal_pitch, turn_mode, has_action, action_time_limit, action_rpt, action_list, action_param) {

    var newWaypoint = upload_waypoint;

    // need a evaluation for valid input parameters
    newWaypoint.SEQ = seq;
    newWaypoint.VALUE.INDEX = index;
    newWaypoint.VALUE.LATI = lati*Math.PI/180;
    newWaypoint.VALUE.LONTI = longi*Math.PI/180;
    newWaypoint.VALUE.ALTI = alti;

    //null stands for defualt value
    newWaypoint.VALUE.DAMPING_DIS = damping_dis == null?upload_waypoint.VALUE.DAMPING_DIS:damping_dis;
    newWaypoint.VALUE.TGT_YAW = tgt_yaw == null? upload_waypoint.VALUE.TGT_YAW : tgt_yaw;
    newWaypoint.VALUE.TGT_GIMBAL_PITCH = tgt_gimbal_pitch == null? upload_waypoint.VALUE.TGT_GIMBAL_PITCH : tgt_gimbal_pitch;
    newWaypoint.VALUE.TURN_MODE = turn_mode == null? upload_waypoint.VALUE.TURN_MODE : turn_mode;
    newWaypoint.VALUE.HAS_ACTION = has_action == null? upload_waypoint.VALUE.HAS_ACTION : has_action;
    newWaypoint.VALUE.ACTION_TIME_LIMIT = action_time_limit == null? upload_waypoint.VALUE.ACTION_TIME_LIMIT : action_time_limit;

    if(newWaypoint.VALUE.HAS_ACTION != 0) {
        newWaypoint.VALUE.ACTION.ACTION_NUM = action_list.length;
        newWaypoint.VALUE.ACTION.ACTION_RPT = action_rpt;

        //Action_list is generated ouside, a better way.
        //newWaypoint.VALUE.COMMAND_LIST = action_list;
    }

    return newWaypoint;
}

