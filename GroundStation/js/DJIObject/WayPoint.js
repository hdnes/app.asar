/**
 * Created by Phoenix on 2015/12/22.
 * Waypoint is the submodule of mission, with its own properties:
 * position(x,y,z), GPS(lati,longi,alti), shadow, textinfo
 */

function Waypoint(position) {
    var scope = this;

    var material = new THREE.MeshBasicMaterial({color: 0xff0000});
    var pointGeometry = new THREE.BoxGeometry(5,5,5);
    var torusGeometry = new THREE.TorusGeometry(2,1.2,5,36);


    var object = new THREE.Mesh( pointGeometry, new THREE.MeshLambertMaterial( {
        color: Math.random() * 0xffffff
    } ) );
    object.material.ambient = object.material.color;
    object.position.copy( position );
    object.castShadow = true;
    object.receiveShadow = true;
    object.my_mash = true;

    this.position = object.position;

    this.object = object;

    this.torus = new THREE.Mesh(torusGeometry, material);
    this.torus.rotateX(-Math.PI/2);

    this.textMesh = new THREE.Mesh();

    this.addScene = function(scene,textScene){
        scene.add(scope.object);
        scene.add(scope.torus);
        textScene.add(scope.textMesh);
    };


    this.updatePosition = function(position){
        scope.object.position = position;
    };

    this.updateTorus = function (){
        scope.torus.position.set(scope.position.x,0,scope.position.z);
    };

    this.updateGPS = function(rateX, rateY, rateZ, init_longitude, init_latitude){
        scope.longitude = (scope.position.x*rateX + init_longitude).toFixed(6);
        scope.altitude  = (scope.position.y*rateY).toFixed();
        scope.latitude  = (scope.position.z*rateZ + init_latitude).toFixed(6);
    };

    this.updateText = function(index,scene){
        scene.remove(scope.textMesh);
        scope.textMesh.material.dispose();
        scope.textMesh.geometry.dispose();

        var text = ""+index+": ("+scope.latitude+", "+scope.longitude+", "+scope.altitude+")";
        var textGeometry = new THREE.TextGeometry(text, {
            size: 15,
            height: 0,
            font: "helvetiker",
            curveSegments: 1,
            weight: "normal",
            style: "normal"
        });

        scope.textMesh = new THREE.Mesh(textGeometry,material);
        scope.textMesh.position.set( 0, 0, 30 * index);
        scope.textMesh.rotateX(-Math.PI / 2);
        scene.add(scope.textMesh);
        textGeometry.dispose();
    };



    this.destructor = function(){
        scope.position = null;
        scope.torus.material.dispose();
        scope.torus.geometry.dispose();
        scope.textMesh.material.dispose();
        scope.textMesh.geometry.dispose();
    }
}