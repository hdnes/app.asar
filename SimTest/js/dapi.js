function SERVICE() {
    this.TYPE = "";
    this.LINK = "";
    this.PATH = "";
}

function PARAM() {
    this.DEFAULT = 0;
    this.MAX = 0;
    this.MIN = 0;
    this.VALUE = 0;
}

PARAM.prototype.parse = function (p) {
    if ("DEFAULT" in p) this.DEFAULT = p.DEFAULT;
    if ("MAX" in p) this.MAX = p.MAX;
    if ("MIN" in p) this.MIN = p.MIN;
};

function DEVICE() {
    "use strict";
    this.DEVICE_TYPE = "";
    this.EVENT = "";
    this.FILE = "";
    this.PRODUCT_TYPE = "";
    this.VERSION = "";

    this.keys = ["DEVICE_TYPE", "EVENT", "FILE", "PRODUCT_TYPE", "VERSION"];
    this.conn = {};

    this.params = {};
    this.push_data = {};
    this.commands = [];
}

DEVICE.prototype.parse = function (data) {
    "use strict";
    for (var i = 0; i < this.keys.length; i++) {
        var key = this.keys[i];
        if (key in data)
            this[key] = data[key];
        else
            return false;
    }
    return true;
};

DEVICE.prototype.get_ws_link = function (ws_type) {
    if ("config" in this.conn) {
        var s = this.conn[ws_type];
        if (s instanceof SERVICE)
            return s.LINK;
    }
    return null;
};

function param_action(dev, action, index, value, on_ok, on_fail){
    if (index in dev.params) {
        var param = dev.params[index];
        var cmd = {};
        cmd.CMD = action;
        cmd.INDEX = index;
        if (action == "write") cmd.VALUE = value;
        cmd.on_reply = function (msg) {
            var val_new = 0;
            if ("VALUE" in msg) val_new = msg.VALUE;
            if ("ERROR" in msg) {
                if (msg.ERROR == "SUCCESS") {
                    param.VALUE = val_new;
                    if (is_function(on_ok))
                        on_ok(param.VALUE);
                } else if (is_function(on_fail)) {
                    on_fail(param.VALUE);
                }
            }
            console.log(action + " : " + JSON.stringify(msg));
        };

        var ws_link = dev.get_ws_link("config");
        if (ws_link) ws_link.Write(cmd);
    }
}

DEVICE.prototype.param_read = function (index, on_ok, on_fail) {
    param_action(this, "read", index, 0, on_ok, on_fail);
};

DEVICE.prototype.param_reset = function (index, on_ok, on_fail) {
    param_action(this, "reset", index, 0, on_ok, on_fail);
};

DEVICE.prototype.param_write = function (index, value, on_ok, on_fail) {
    param_action(this, "write", index, value, on_ok, on_fail);
};

DEVICE.prototype.on_config_message = function (data) {
    //console.log(data);
    var e = JSON.parse(data);
    //console.log(e);
    if ("EVENT" in e) {
        if (e.EVENT == "sync_progress") { // show a sync progress
            console.log(e);
        } else if (e.EVENT == "initial_ready") { // all config table data is ready
            if ("LIST" in e) { // all available param
                for (var key in e.LIST) {
                    var param = new PARAM();
                    param.parse(e.LIST[key]);
                    this.params[key] = param;
                }
            }
            if ("PUSH" in e) { // push data list
                this.push_data = e.PUSH;
            }
            if ("COMMAND" in e) { // action command
                this.commands = e.COMMAND;
            }
            console.log(this); // dump the config var
        } else {
            console.log("Unhandled : " + JSON.stringify(e));
            //console.log(e); // unknown event
        }
    }
};

function is_function(obj) {
    return typeof obj == "function";
}

function std_general_handler() {
    "use strict";
}

// general: "ws://localhost:19870/general"
// config: "ws://localhost:19870/controller/config/XXXXXXXXX"
// upgrade: "ws://localhost:19870/controller/upgrade/XXXXXXXXX"
// navigation: "ws://localhost:19870/controller/navigation/XXXXXXXXX"
// simulator: "ws://localhost:19870/controller/simulator/XXXXXXXXX"
function ServiceIo(ws_url, on_ws_message, auto_retry, on_ws_failure, on_ws_success) {
    "use strict";
    this.cur_ws = null;
    this.cur_status = "service_failure";
    this.cmd_history_ = {};

    if (ws_url == null)
        ws_url = "ws://localhost:19870/general";
    if (auto_retry == null) auto_retry = true;

    var self = this;


    var do_connect = function () {
        var service_websocket = new WebSocket(ws_url);

        service_websocket.onopen = function () {
            console.log(ws_url + " service connect ok!");
            self.cur_ws = this;
            self.cur_status = "link_ok";
            if (is_function(on_ws_success))
                on_ws_success();
        };
        service_websocket.onclose = function () {
            self.cur_ws = null;
            console.log(ws_url + " service closed!");
            self.cur_status = "service_failure";
            if (auto_retry)
                do_connect(); // just retry
            if (is_function(on_ws_failure))
                on_ws_failure(); // notify no this type of service!
        };
        service_websocket.onerror = function () {
            self.cur_ws = null;
            console.log(ws_url + " service error!");
        };
        service_websocket.onmessage = function (e) {
            var msg = JSON.parse(e.data);
            if ("SEQ" in msg) { // text with seq
                if (msg.SEQ in self.cmd_history_) { // seq is send by self.Write
                    var cmd = self.cmd_history_[msg.SEQ];
                    if (is_function(cmd.on_reply)) { // try to call command on_reply
                        cmd.on_reply(msg);
                    }
                    delete self.cmd_history_[msg.SEQ]; // remove from trace object
                    return; // ack msg already handled
                }
            }
            if (is_function(on_ws_message)) on_ws_message(e);
        };
    };
    do_connect();
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

function WebServiceGeneral() {
    var self = this;
    this.device_list = {};
    this.servio = new ServiceIo("ws://localhost:19870/general", function (e) {
        self.on_message(e);
    });
}


function InitialService(device, ws_type, on_message) {
    if (ws_type == null) ws_type = "config"; // default service want to init
    if (device instanceof DEVICE) {
        var ws_url = "ws://localhost:19870/controller/config/user/" + device.FILE;
        var ws_config = new ServiceIo(ws_url,
            function (e) { // on link message
                if (is_function(on_message)) on_message(e.data);
            },
            false, // connect only once
            function () { // on_connect_fail event
                console.log("device [" + device.FILE + "] doesn't have config service!");
                console.log(device);
                if (ws_type in device.conn)
                    delete device.conn[ws_type];
            }, function () { // on open success
                var s = new SERVICE();
                s.LINK = ws_config;
                s.TYPE = ws_type;
                s.PATH = ws_url;
                device.conn[s.TYPE] = s;
            }
        );
    }
}

WebServiceGeneral.prototype.on_message = function (e) {
    console.log(this);
    var msg = JSON.parse(e.data);
    var device_info = new DEVICE();
    if (device_info.parse(msg)) {
        this.device_list[device_info.FILE] = device_info;
        InitialService(
            device_info,
            "config",
            function (data) { // config data update
                device_info.on_config_message(data);
            }
        );
    }
};

var web_service_general = null;
window.onload = function () {
    "use strict";
    web_service_general = new WebServiceGeneral();
};