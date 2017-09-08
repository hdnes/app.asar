/**
 * Created by itolfo2 on 2015/10/26.
 */
function is_function(obj) {
    return typeof obj == "function";
}

// general   : "ws://localhost:19870/general"
// config    : "ws://localhost:19870/controller/config/XXXXXXXXX"
// upgrade   : "ws://localhost:19870/controller/upgrade/XXXXXXXXX"
// navigation: "ws://localhost:19870/controller/navigation/XXXXXXXXX"
// simulator : "ws://localhost:19870/controller/simulator/XXXXXXXXX"
function ServiceIo() {
    this.cur_ws = null;
    this.cur_status = "service_failure";
    this.cmd_history_ = {}; // internal map, trace all command that send by Write().
}

// cmd object must have a callback function [on_reply] object
// if no this function object, just log to console
ServiceIo.prototype.Write = function (cmd) {
    var seq = Math.random().toString(36).substring(7); // generate random seq string
    cmd.SEQ = seq; // insert command with seq
    this.cmd_history_[seq] = cmd; // save the send command

    var txt = JSON.stringify(cmd);
    if (this.cur_ws instanceof WebSocket) {
        this.cur_ws.send(txt);
    }
};

ServiceIo.prototype.Connect = function (ws_url, on_ws_message, auto_retry, on_ws_failure, on_ws_success) {
    if (ws_url == null)
        ws_url = "ws://localhost:19870/general";
    if (auto_retry == null) auto_retry = true;
    var self_ = this;
    var do_connect = function () {
        var service_websocket = new WebSocket(ws_url);

        service_websocket.onopen = function () {
            console.log("[" + ws_url + "] service connect ok!");
            self_.cur_ws = this;
            self_.cur_status = "link_ok";
            if (is_function(on_ws_success))
                on_ws_success();
        };
        service_websocket.onclose = function () {
            self_.cur_ws = null;
            console.log("[" + ws_url + "] service closed!");
            self_.cur_status = "service_failure";
            if (auto_retry)
                do_connect(); // just retry
            if (is_function(on_ws_failure))
                on_ws_failure(); // notify no this type of service!
        };
        service_websocket.onerror = function () {
            self_.cur_ws = null;
            console.log("[" + ws_url + "] service error!");
        };
        service_websocket.onmessage = function (e) {
            var msg = JSON.parse(e.data);
            if ("SEQ" in msg) { // text with seq
                if (msg.SEQ in self_.cmd_history_) { // seq is send by self.Write
                    var cmd = self_.cmd_history_[msg.SEQ];
                    if (is_function(cmd.on_reply)) { // try to call command on_reply
                        cmd.on_reply(msg);
                    }
                    delete self_.cmd_history_[msg.SEQ]; // remove from trace object
                    return; // ack msg already handled
                }
            }

            if (is_function(on_ws_message)) on_ws_message(e);
        };
    };
    do_connect();
};


function DJIServiceGeneral() {
    var self_ = this;
    this.device_list = {};
    this.servio = new ServiceIo();
}

DJIServiceGeneral.prototype.OnMessage = function (e, on_device_event) {
    var msg = JSON.parse(e.data);

    if ('FILE' in msg) {
        this.device_list[msg['FILE']] = msg;
        if (is_function(on_device_event)) on_device_event(msg);
        return;
    } else {
        console.log(msg);
    }
};

DJIServiceGeneral.prototype.Connect = function (on_device_event) {
    var self_ = this;
    this.servio.Connect("ws://localhost:19870/general", function (e) {
        self_.OnMessage(e, on_device_event);
    });
};


function DJIServiceSimulator() {
    var self = this;
    this.FILE = "";
    this.servio = new ServiceIo();
    this.on_sim_status = null; // callback function for update Simulator View
    this.sim_latitude = 1;
    this.sim_longitude = 1;
    this.sim_freq = 50;
    this.sim_only_aircraft = 1;
}

DJIServiceSimulator.prototype.OnMessage = function (e) {
    var msg = JSON.parse(e.data);
    // check if sim status update
    if (msg["EVENT"] == "sim_state" && is_function(this.on_sim_status)) this.on_sim_status(msg);
    else console.log(msg);
};

DJIServiceSimulator.prototype.Connect = function (device) {
    var self = this;
    this.FILE = device["FILE"];
    this.servio.Connect("ws://localhost:19870/controller/simulator/" + this.FILE,
        function (e) {
            self.OnMessage(e);
        },
        true,
        function () {
        },
        function () {
            self.OnConnected();
        }
    );
};

DJIServiceSimulator.prototype.OnConnected = function () {
    //this.Start(); // use default parameter
};

DJIServiceSimulator.prototype.Start = function (latitude, longitude, freq, only_aircraft) {
    if (latitude != null) this.sim_latitude = latitude;
    if (longitude != null) this.sim_longitude = longitude;
    if (freq != null) this.sim_freq = freq;
    if (only_aircraft != null)this.sim_only_aircraft = only_aircraft;

    var cmd = {};
    cmd["CMD"] = "start_sim";
    cmd["latitude"] = this.sim_latitude;
    cmd["longitude"] = this.sim_longitude;
    cmd["frequency"] = this.sim_freq;
    cmd["only_aircraft"] = this.sim_only_aircraft;
    this.servio.Write(cmd);
};

DJIServiceSimulator.prototype.Stop = function () {
    var cmd = {};
    cmd["CMD"] = "stop_sim";
    this.servio.Write(cmd);
};