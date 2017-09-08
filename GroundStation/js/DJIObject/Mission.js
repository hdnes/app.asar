/**
 * Created by Phoenix on 2015/12/23.
 * Mission is the smallest unit of a flight task.
 * i.e. everything above the map,
 * including lines/points and related functions.
 * multi drones multi missions
 *
 */

function Mission (scene1,scene2){
    var scope = this;
    var isGSOpened = 0;

    this.scene = scene1;
    this.textScene = scene2;
    this.waypoints = [];
    this.lines = [];


    this.subObject = [];

    var rateLongitudeRight, rateLatitudeDown;
    var init_latitude, init_longitude;

    this.initWebSocket = function(socket){
        scope.websocket = new Communicator(socket);
        scope.websocket.updateMissionList(scope.waypoints);
    };

    this.initOnboardSDK = function(){
        scope.sdk = new OnboardSDK();
    };

    this.openGS = function(){
        if(scope.websocket != null) {
            scope.websocket.setNavigationMode();
            isGSOpened = 1;
        }
        else{
            alert("Drone not connected!")
        }
    };

    this.uploadMission = function(){
        if(isGSOpened == 1){
            scope.websocket.uploadWayline();
        }
        else{
            alert("Pls Open Groundstation first!");
        }
    };

    this.startMission = function(){
        if(isGSOpened == 1){
            scope.websocket.startWayline();
        }
        else{
            alert("Pls Open Groundstation first!");
        }
    };

    this.updateGPSParameter= function(rateLongitudeRight_, rateLatitudeDown_, init_longitude_,init_latitude_){
        rateLongitudeRight = rateLongitudeRight_;
        rateLatitudeDown = rateLatitudeDown_;
        init_latitude = init_latitude_;
        init_longitude = init_longitude_;
    };
    this.addPoint = function(position){
        if(position){

        }
        else {
            position = {
                x: Math.random() * 1000 - 500,
                y: Math.random() * 600,
                z: Math.random() * 800 - 400
            };
        }

        var newWaypoint = new Waypoint(position);
        newWaypoint.addScene(scope.scene,scope.textScene);
        scope.waypoints.push(newWaypoint );
        scope.subObject.push(newWaypoint.object);

        //update everything
        scope.updateEverything();
    };

    this.removePoint = function(){
        if ( scope.waypoints.length<= 4 ) {
            return;
        }
        scope.destructPoint(scope.waypoints.pop());
        scope.subObject.pop();

        scope.updateEverything();
    };

    this.destructPoint = function(waypoint){
        scope.scene.remove(waypoint.object);
        scope.scene.remove(waypoint.torus);
        scope.textScene.remove(waypoint.textMesh);
        waypoint.destructor();
    };

    this.loadPoint = function(positions){
        var i = 0;
        while ( positions.length > scope.waypoints.length ) {
            scope.addPoint(positions[i]);
            i++;
        }

        while ( positions.length < scope.waypoints.length ) {
            scope.removePoint();
        }

        for ( i = 0; i < positions.length; i ++ ) {
            scope.waypoints[ i ].updatePosition( positions[ i ] );
        }
        //update everything
        scope.updateEverything();
    };

    this.clearPath = function(){
        for (var i = 0; i < scope.lines.length; i ++){
            scope.scene.remove(scope.lines[i].pathMesh);
            scope.lines[i].pathMesh.geometry.dispose();
            scope.lines[i].pathMesh.material.dispose();
        }
        scope.lines = [];
    };

    this.drawPath = function(){
        for (var i = 1; i < scope.waypoints.length; i++){
            var path = new Path(scope.waypoints[i-1].position,scope.waypoints[i].position);
            scope.scene.add(path.pathMesh);
            scope.lines.push(path);
        }
    };

    this.updateEverything = function(){
        //update position
        //Already updated by move event

        //update shadow/text
        for (var i = 0; i < scope.waypoints.length;i++){
            scope.waypoints[i].updateGPS(rateLongitudeRight, 1, rateLatitudeDown, init_longitude, init_latitude);
            scope.waypoints[i].updateTorus();
            scope.waypoints[i].updateText(i,scope.textScene);
        }

        //update Path
        scope.clearPath();
        scope.drawPath();
    }
}
