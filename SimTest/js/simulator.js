/**
 * Created by itolfo2 on 2015/10/23.
 */
// Our Javascript will go here.
String.prototype.format = function () {
    var str = this;
    for (var i = 0; i < arguments.length; i++) {
        str = str.replace('{' + i + '}', arguments[i]);
    }
    return str;
};

var container, stats;
var camera, scene, renderer, atti_renderer, atti_camera;
var splineHelperObjects = [];
var splineOutline;
var splinePointsLength = 4;
var positions = [];
var options;
var geometry = new THREE.BoxGeometry(20, 20, 20);
var ARC_SEGMENTS = 200;
var splineMesh;
var splines = {};
var spotlight;
var controls, atti_controls;
var transformControl;
var aircraft = new Aircraft();
var clearColor = 0xb0b0b0;
var lineMaterial = new THREE.LineBasicMaterial({
    color: 0xFF00ff
});
var aircraftPathGeometry = new THREE.Geometry();
var aircraftPathMesh;
var rendererClock = new THREE.Clock();

var atti_view_div;

var dynamicPoints = new Array();
var dynamicPointMesh = new Array();
function drawDynamicPath(p) {
    if (dynamicPoints == null || dynamicPointMesh == null)
        return;
    if (dynamicPoints.length > 0) {
        // check if new position is near to last point, if is, return
        var last_p = dynamicPoints[dynamicPoints.length - 1];
        var v_diff = new THREE.Vector3();
        v_diff.subVectors(p, last_p);
        if (v_diff.length() < 0.1)
            return;

        var g = new THREE.Geometry();
        g.vertices.push(dynamicPoints[dynamicPoints.length - 1]);
        g.vertices.push(p);
        var m = new THREE.Line(g, lineMaterial);
        scene.add(m);
        dynamicPointMesh.push(m);
    }
    dynamicPoints.push(p);

    if (dynamicPointMesh.length > 2000) {
        scene.remove(dynamicPointMesh.shift());
    }
    if (dynamicPoints.length > 3000) {
        dynamicPoints.shift();
    }
}

function Aircraft() {
    this.object = null;
    this.scale = 1;
    this.transform_base = new THREE.Matrix4();
    this.transform = new THREE.Matrix4();
    this.rotationM = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.Reset = function () {
        this.transform.copy(this.transform_base);
    };

    var scope = this;

    this.Update = function () {
        if (scope.object == null)
            return;
        scope.object.scale.set(scope.scale, scope.scale, scope.scale);
        scope.rotationM.extractRotation(scope.transform);
        scope.object.rotation.setFromRotationMatrix(scope.rotationM);
        scope.object.position.setFromMatrixPosition(scope.transform);
    };
    this.SetCurrentAsInitial = function () {
        this.transform_base.copy(this.transform);
    };
    this.SetScale = function (s) {
        this.scale = s;
        this.Update();
    };
    this.SetATTI = function (q) {
        var m = new THREE.Matrix4();
        m.makeRotationFromQuaternion(q);
        m.multiply(this.transform);
        this.transform.copy(m);
        this.Update();
    };
    this.SetPosition = function (p) {
        this.position.copy(p);
        this.transform.setPosition(p);
        this.Update();
    };

    this.Unload = function(){
        if (this.object != null) {
            scene.remove(this.object);
            this.object = null;
        }
    };
}

function load_sample(){
    var loader = new THREE.ObjectLoader();
    loader.load("data/t33.json", function (obj) {
        aircraft.Unload();
        aircraft.object = obj;
        aircraft.SetScale(0.0175);
        aircraft.transform.makeRotationY(-Math.PI / 2);
        aircraft.SetCurrentAsInitial();
        aircraft.Update();
        scene.add(obj);
    });
}

function createSky() {
    var path = "data/";
    var format = '.jpg';
    var urls = [
        path + 'px' + format, path + 'nx' + format,
        path + 'py' + format, path + 'ny' + format,
        path + 'pz' + format, path + 'nz' + format
    ];

    var textureCube = THREE.ImageUtils.loadTextureCube(urls);

    var shader = THREE.ShaderLib["cube"];
    shader.uniforms["tCube"].value = textureCube;

    // We're inside the box, so make sure to render the backsides
    // It will typically be rendered first in the scene and without depth so anything else will be drawn in front
    var material = new THREE.ShaderMaterial({
        fragmentShader : shader.fragmentShader,
        vertexShader   : shader.vertexShader,
        uniforms       : shader.uniforms,
        depthWrite     : false,
        side           : THREE.BackSide
    });

    // The box dimension size doesn't matter that much when the camera is in the center.  Experiment with the values.
    var skyMesh = new THREE.Mesh( new THREE.CubeGeometry( 10000, 10000, 10000, 1, 1, 1 ), material );
    skyMesh.renderDepth = -10;


    scene.add(skyMesh);
}

function load_m100() {
    var loader = new THREE.OBJMTLLoader();
    loader.load( 'data/m100_body.obj', 'data/m100_body.mtl', function ( object ) {
        aircraft.Unload();
        aircraft.object = object;
        aircraft.transform.makeRotationX(-Math.PI / 2);
        var r = new THREE.Matrix4();
        r.makeRotationZ(-Math.PI / 2);
        aircraft.transform.multiply(r);
        aircraft.SetScale(2);
        aircraft.SetCurrentAsInitial();
        aircraft.Update();
        scene.add( object );
    });
}

function init() {
    rendererClock.start();
    container = document.getElementById('view_main');
    //document.body.appendChild(container);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 10000);
    camera.position.x = -10;
    camera.position.y = 50;
    camera.position.z = 30;

    scene.add(camera);
    scene.add(new THREE.AmbientLight(0xffffff));

    // draw grid at y = 0, base size 10
    var helper = new THREE.GridHelper(1000, 10);
    helper.position.y = 0;
    helper.material.opacity = 0.15;
    helper.material.transparent = true;
    scene.add(helper);

    // create a axis helper at 0,0,0
    var axis = new THREE.AxisHelper(10);
    axis.position.set(0, 0, 0);
    axis.material.transparent = false;
    scene.add(axis);

    // Loading manager
    var manager = new THREE.LoadingManager();
    manager.onProgress = function ( item, loaded, total ) {
        console.log( item, loaded, total );
    };

    // Create update object
    load_m100();
    createSky();

    // create renderer
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setClearColor(clearColor);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // FPS stats
    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    stats.domElement.style.left = window.innerWidth - 80 + 'px';
    container.appendChild(stats.domElement);

    // Camera Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.damping = 0.2;
    //controls.maxDistance = 100;
    controls.addEventListener('change', render);

    transformControl = new THREE.TransformControls(camera, renderer.domElement);
    transformControl.addEventListener('change', render);
    scene.add(transformControl);

    // Hiding transform situation is a little in a mess :()
    transformControl.addEventListener('change', function (e) {
    });

    transformControl.addEventListener('mouseDown', function (e) {
    });

    transformControl.addEventListener('mouseUp', function (e) {
    });

    transformControl.addEventListener('objectChange', function (e) {
    });

    var dragcontrols = new THREE.DragControls(camera, splineHelperObjects, renderer.domElement); //
    dragcontrols.on('hoveron', function (e) {
        transformControl.attach(e.object);
    });

    dragcontrols.on('hoveroff', function (e) {
    });
}

function generateTexture() {
    var canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    var context = canvas.getContext('2d');
    var image = context.getImageData(0, 0, 256, 256);
    var x = 0, y = 0;
    for (var i = 0, j = 0, l = image.data.length; i < l; i += 4, j++) {
        x = j % 256;
        y = x == 0 ? y + 1 : y;
        image.data[i] = 255;
        image.data[i + 1] = 255;
        image.data[i + 2] = 255;
        image.data[i + 3] = Math.floor(x ^ y);
    }
    context.putImageData(image, 0, 0);
    return canvas;
}

function addSplineObject(position) {

    var object = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({
        color: Math.random() * 0xffffff
    }));
    object.material.ambient = object.material.color;
    if (position) {

        object.position.copy(position);

    } else {
        object.position.x = Math.random() * 1000 - 500;
        object.position.y = Math.random() * 600;
        object.position.z = Math.random() * 800 - 400;
    }

    object.castShadow = true;
    object.receiveShadow = true;
    scene.add(object);
    splineHelperObjects.push(object);
    return object;
}

function addPoint() {
    splinePointsLength++;
    positions.push(addSplineObject()
        .position);
    updateSplineOutline();
}

function removePoint() {
    if (splinePointsLength <= 4) {
        return;
    }
    splinePointsLength--;
    positions.pop();
    scene.remove(splineHelperObjects.pop());
    updateSplineOutline();
}

function updateSplineOutline() {
    var p;
    for (var k in splines) {
        var spline = splines[k];
        splineMesh = spline.mesh;
        for (var i = 0; i < ARC_SEGMENTS; i++) {
            p = splineMesh.geometry.vertices[i];
            p.copy(spline.getPoint(i / ( ARC_SEGMENTS - 1 )));
        }
        splineMesh.geometry.verticesNeedUpdate = true;
    }
}

function exportSpline() {
    var p;
    var strplace = [];
    for (i = 0; i < splinePointsLength; i++) {

        p = splineHelperObjects[i].position;
        strplace.push('new THREE.Vector3({0}, {1}, {2})'.format(p.x, p.y, p.z))

    }
    console.log(strplace.join(',\n'));
    var code = '[' + ( strplace.join(',\n\t') ) + ']';
    prompt('copy and paste code', code);
}

function load(new_positions) {
    while (new_positions.length > positions.length) {
        addPoint();
    }

    while (new_positions.length < positions.length) {
        removePoint();
    }

    for (i = 0; i < positions.length; i++) {
        positions[i].copy(new_positions[i]);
    }
    updateSplineOutline();
}

function animate() {
    requestAnimationFrame(animate);
    render();
    stats.update();
    controls.update();
    atti_controls.update();
}

function render() {
    renderer.render(scene, camera);
    atti_renderer.render(scene, atti_camera);
}

function onWindowResize() {
    stats.domElement.style.left = window.innerWidth - 80 + 'px';
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    atti_renderer.setSize(atti_view_div.clientWidth, atti_view_div.clientHeight);
}
window.addEventListener('resize', onWindowResize, false);

function clearFlyPath() {
    if (dynamicPointMesh == null) return;
    for (var i = 0; i < dynamicPointMesh.length; i++) {
        scene.remove(dynamicPointMesh[i]);
    }
    dynamicPointMesh = [];
    dynamicPoints = [];
}

///////////////////////////////////////////////////////////
// begin code for WebSocket Simulator interface
///////////////////////////////////////////////////////////

// create simulator service object
var service_simulator = new DJIServiceSimulator();

// set update scene data method
service_simulator.on_sim_status = function (e) {
    //console.log(e);
    var q = new THREE.Quaternion();
    q.set(e.Quaternion1, -e.Quaternion3, e.Quaternion2, e.Quaternion0);

    var v = new THREE.Vector3(e.WorldX, e.WorldY, e.WorldZ);
    //console.log(v);
    var a_p = new THREE.Vector3(e.WorldX, e.WorldZ, e.WorldY);

    var c_offset = new THREE.Vector3();
    c_offset.copy(atti_camera.position).sub(aircraft.position);

    aircraft.Reset();
    aircraft.SetATTI(q);
    aircraft.SetPosition(a_p);

    var cam_posi_n = new THREE.Vector3();
    cam_posi_n.copy(a_p).add(c_offset);
    atti_camera.position.copy(cam_posi_n);
    atti_controls.target.copy(a_p);

    drawDynamicPath(a_p);
    //controls.target.copy(a_p); // no need to follow the aircraft
    if (div_status != null) {
        div_status.innerHTML = "FlyStatus : " + e.FlyingState;
    }
    updateSimulatorVar(e);
};

function simulator_device_arrival(e) { // handle for simulator device
    console.log("SIMULATOR connected : " + e["DEVICE_TYPE"]);
    service_simulator.Connect(e);
}

function device_arrival(e) { // dispatch device arrival event
    if (e["PRODUCT_TYPE"] == "Controller")simulator_device_arrival(e);
}

// create general service, this service will broadcast device arrival and remove event
var service_general = new DJIServiceGeneral();

// Connect, reg event for device arrival
service_general.Connect(function (e) {
    console.log(e);
    if (e["EVENT"] == "device_arrival") device_arrival(e);
});


function updateSimulatorVar(e) {
    var dom = document.getElementById("sim_status_val");

    var m = function (index) {
        return '<div>' + index + ' : ' + e[index] + '</div>';
    };
    var a = "";
    for (var key in e) {
        a += m(key)
    }
    dom.innerHTML = a;
}

function createATTIRenderer() {
    atti_view_div = document.getElementById("view_atti");
    atti_renderer = new THREE.WebGLRenderer({antialias: true});
    atti_renderer.setClearColor(0xa0a0a0);
    atti_renderer.setSize(atti_view_div.clientWidth, atti_view_div.clientHeight);
    atti_view_div.appendChild(atti_renderer.domElement);

    atti_camera = new THREE.PerspectiveCamera(75, atti_view_div.clientWidth / atti_view_div.clientHeight, 0.01, 10000);
    atti_camera.position.x = -1.2;
    atti_camera.position.y = 0.7;
    atti_camera.position.z = 0;

    atti_controls = new THREE.OrbitControls(atti_camera, atti_renderer.domElement);
    atti_controls.damping = 0.2;
    atti_controls.addEventListener('change', render);
}

var div_status = null;
// function for Simulator control
window.onload = function () {
    var btn_start = document.getElementById("sim-start");
    btn_start.onclick = function () {
        service_simulator.Start();
    };

    var btn_stop = document.getElementById("sim-stop");
    btn_stop.onclick = function () {
        service_simulator.Stop();
        if (div_status != null)
            div_status.innerHTML = "Unknown";
    };

    var btn_clear = document.getElementById("clear-path");
    btn_clear.onclick = function () {
        clearFlyPath();
    };

    var btn_find_aircraft = document.getElementById("find_aircraft");
    btn_find_aircraft.onclick = function () {
        controls.target.copy(aircraft.position);
    };


    div_status = document.getElementById('sim_status');
    init();
    createATTIRenderer();
    animate();
    container.onkeydown = function (event) {
        if (event.keyCode == 32)
            controls.target.copy(aircraft.position);
    };
};
