/**
 * Created by Phoenix on 2015/12/22.
 */


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

function createSky(scene) {
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

var aircraft = new Aircraft();

function loadM100(scene) {
    var loader = new THREE.OBJMTLLoader();
    loader.load( 'data/m100_body.obj', 'data/m100_body.mtl', function ( object ) {
        aircraft.Unload();
        aircraft.object = object;
        aircraft.transform.makeRotationX(-Math.PI / 2);
        var r = new THREE.Matrix4();
        r.makeRotationZ(-Math.PI / 2);
        aircraft.transform.multiply(r);
        aircraft.SetScale(100); //needs to modify
        aircraft.SetCurrentAsInitial();
        aircraft.Update();
        scene.add( object );
    });
}
