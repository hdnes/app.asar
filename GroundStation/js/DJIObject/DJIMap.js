/**
 * Created by Phoenix on 2015/12/23.
 */

function DJIMap(container) {
    //init latitude/init longitude
    var scope = this;

    var scene, textScene;
    var camera, textCamera;
    var renderer;
    var controls,transformControl;
    var mapPlane = [];
    var mapLocation = [];
    this.mission = [];
    this.aircraft= [];

    var material = new THREE.MeshBasicMaterial({color: 0xff0000});

    //default centre
    this.initLatitude = 22.3363168;
    this.initLongitude = 114.2659089;

    var scale = 18;  //default scaler
    var rateLongitudeRight = 0.011/Math.pow(2,scale-7);// (/512)->16;
    var rateLatitudeDown = -0.0102/Math.pow(2,scale-7);// (/512)->16;

    this.container = container;

    this.initPosition = function(latitude, longitude){
        scope.initLatitude = latitude;
        scope.initLongitude = longitude;
    };

    //two scenes
    scene = new THREE.Scene();
    textScene = new THREE.Scene();


    //camera init
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 1000;
    scene.add(camera);
    textCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10000);
    textCamera.position.set(-700,800,480); // left/right, reserve, up/down
    textCamera.lookAt(new THREE.Vector3(-700,0,480));
    textCamera.rotation.z = 0;
    textScene.add(textCamera);

    //the light
    scene.add( new THREE.AmbientLight( 0xf0f0f0 ) );
    textScene.add( new THREE.AmbientLight( 0xf0f0f0 ) );

    //the aircraft list and mission list
    this.aircraft.push( new Aircraft());
    this.mission.push(new Mission(scene,textScene));

    //the init map
    updateRate();
    for (var i = -1; i <= 1; i ++){
        for (var j = -1; j <= 1; j ++){
            loadMap(scope.initLatitude-i*512*rateLatitudeDown, scope.initLongitude+j*512*rateLongitudeRight, 512*j,-512*i);
        }
    }

    //the axis
    var axis = new THREE.AxisHelper();
    axis.position.set( -500, -500, -500 );
    scene.add( axis );

    //the renderer
    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setClearColor( 0xf0f0f0 );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;
    renderer.autoClear = false;

    this.container.appendChild(renderer.domElement);

    //controls

    controls = new THREE.OrbitControls( camera, renderer.domElement );
    controls.damping = 0.2;
    controls.addEventListener( 'change', render );

    transformControl = new THREE.TransformControls( camera, renderer.domElement );
    transformControl.addEventListener( 'change', render );

    scene.add( transformControl );

    //all other inits with the event listener
    transformControl.addEventListener( 'change', function( e ) {
        cancelHideTransorm();

    } );

    transformControl.addEventListener( 'mouseDown', function( e ) {

        cancelHideTransorm();

    } );

    transformControl.addEventListener( 'mouseUp', function( e ) {
        delayHideTransform();

    } );

    transformControl.addEventListener( 'objectChange', function( e ) {

        updateEveryMission();

    } );

    //also need a splineHelperObjects list
    //or a drag control -part of> a mission
    var dragcontrols = new THREE.DragControls( camera, scope.mission[0].subObject, renderer.domElement ); //a dirty way

    dragcontrols.on( 'hoveron', function( e ) {

        transformControl.attach( e.object );
        cancelHideTransorm();

    } );

    dragcontrols.on( 'hoveroff', function( e ) {

        if ( e ) delayHideTransform();

    } );


    controls.addEventListener( 'start', function() {

        cancelHideTransorm();

    } );

    controls.addEventListener( 'end', function() {

        delayHideTransform();
        updateMap();
    } );

    controls.domElement.addEventListener('mousewheel', function(event){
        if(event.ctrlKey){
            controls.minDistance = controls.constraint.radius_.toFixed();
            controls.maxDistance = controls.constraint.radius_.toFixed();
            if(controls.scrollData > 0){
                scale ++;
                controls.target.x *=2;
                controls.target.z *=2;
                camera.position.x *=2;
                camera.position.z *=2;

                for (var i = 0; i < scope.mission[0].waypoints.length; i++){
                    scope.mission[0].waypoints[i].position.x*=2;
                    scope.mission[0].waypoints[i].position.z*=2;
                }
            }
            else if(controls.scrollData < 0){
                scale --;
                controls.target.x /=2;
                controls.target.z /=2;
                camera.position.x /=2;
                camera.position.z /=2;

                for (var i = 0; i < scope.mission[0].waypoints.length; i++){
                    scope.mission[0].waypoints[i].position.x/=2;
                    scope.mission[0].waypoints[i].position.z/=2;
                }
            }
            else{

            }
            removeMap();
            updateMap();

            updateEveryMission();
        }
        else{
            controls.minDistance = 400;
            controls.maxDistance = 2000;
        }

    } );
    var hiding;

    function delayHideTransform() {

        cancelHideTransorm();
        hideTransform();

    }

    function hideTransform() {

        hiding = setTimeout( function() {

            transformControl.detach( transformControl.object );

        }, 2500 )

    }

    function cancelHideTransorm() {

        if ( hiding ) clearTimeout( hiding );

    }

    //add text in textScene
    var text = "Index, Latitude, Longitude, Altitude";
    var textGeometry = new THREE.TextGeometry(text,{
        size:15,
        height:0,
        font:"helvetiker",
        curveSegments:1,
        weight:"normal",
        style:"normal"
    });
    var textGeometryMesh = new THREE.Mesh(textGeometry,material);
    textGeometryMesh.position.set(0,0,-30);
    textGeometryMesh.rotateX(-Math.PI / 2);
    textScene.add(textGeometryMesh);

    loadM100(scene);
    createSky(scene);


    function updateEveryMission(){
        for (var i = 0; i < scope.mission.length; i++){
            scope.mission[i].updateEverything();
        }
    }

    //update Rate
    function updateRate(){
        rateLongitudeRight = 0.011/Math.pow(2,scale-7);// (/512)->16;
        rateLatitudeDown = -0.0102/Math.pow(2,scale-7);// (/512)->16;
        scope.mission[0].updateGPSParameter(rateLongitudeRight,rateLatitudeDown,scope.initLongitude,scope.initLatitude);
    }

    //load and remove map
    function loadMap(latitude, longitude, x, z){
        for (var i = 0; i < mapLocation.length; i++){
            if((x == mapLocation[i].X) && (z == mapLocation[i].Z)){
               return;
            }
        }

        var texloader = new THREE.TextureLoader();
        texloader.setCrossOrigin('');
        var tex = texloader.load("https://maps.googleapis.com/maps/api/staticmap?center=" + latitude + "," + longitude + "&zoom="+ scale + "&size=512x512&key=AIzaSyCC9wt1CChcOEDAuTgH10Y75Fj5l1ai2dE");
        //var tex = texloader.load("https://api.mapbox.com/v4/mapbox.streets/"+longitude+","+latitude+",16/512x512.png128?access_token=pk.eyJ1IjoibGFueXVzZWEiLCJhIjoiY2lpNnJtYzdoMDF1ZnRybTA0bTZlMmNtciJ9.9fKQNjEiRCCkSCXpMBWK1w");

        //a plane in the ground
        var planeGeometry = new THREE.PlaneGeometry(512, 512);
        planeGeometry.rotateX(-Math.PI / 2);
        var planeMaterial = new THREE.MeshBasicMaterial({color: 0xeeeeee, map: tex});

        var plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.position.x = x;
        plane.position.z = z;
        plane.position.y = 0;

        plane.receiveShadow = true;
        scene.add(plane);
        mapPlane.push(plane);

        var mapCoordinate = {X: x, Z: z};
        mapLocation.push(mapCoordinate);
    }

    function removeMap(){
        for (var i = 0; i < mapPlane.length; i++){
            scene.remove(mapPlane[i]);
        }
        mapPlane = [];
        mapLocation = [];
    }

    function updateMap(){
        var roll = camera.rotation.y;//
        var pitch = camera.rotation.x;//[-pi, 0]
        var yaw = camera.rotation.z;//[0,pi)(-pi,0]

        //unit is 512
        var newCenterX = ((camera.position.x - 1000*Math.sin(roll))/512).toFixed()*512;
        var newCenterZ = ((camera.position.z - 1000*Math.cos(pitch)*Math.cos(roll))/512).toFixed()*512;
        //camera mode is a completed mystery, I have to *Math.cos(roll) for movement on z-axis.

        //latitude/longitude for the center point
        updateRate();
        var newLatitude = scope.initLatitude + newCenterZ*rateLatitudeDown;
        var newLongitude = scope.initLongitude + newCenterX*rateLongitudeRight;

        for (var i = -1; i <= 1; i ++){
            for (var j = -1; j <= 1; j ++){
                loadMap(newLatitude-i*512*rateLatitudeDown,
                        newLongitude+j*512*rateLongitudeRight,
                        512*j  + newCenterX,
                        -512*i + newCenterZ
                        );
            }
        }
    }

    this.rendererUpdate = function(){
        renderer.clear();
        renderer.render( scene, camera );
        renderer.clearDepth();
        renderer.render(textScene,textCamera);
    };

    this.controlUpdate = function(){
        controls.update();
        transformControl.update();
    };

    //add mission

    //remove mission (with index)

}
