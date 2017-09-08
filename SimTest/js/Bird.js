/**
 * Created by itolfo2 on 2015/10/27.
 */
var Bird = function () {

    var scope = this;

    THREE.Geometry.call( this );

    v(   5,   0,   0 ); // header
    v( - 5, - 2,   1 ); // tail left
    v( - 5,   0,   0 ); // tail
    v( - 5, - 2, - 1 ); // tail right

    v(   0,   2, - 6 );  // 4, l arm
    v(   0,   2,   6 );  // 5, r arm
    v(   2,   0,   0 );  // 6, f arm
    v( - 3,   0,   0 );  // 7, b arm


    f3( 0, 2, 1 );
    f3( 0, 3, 2 );

    f3( 4, 7, 6 );
    f3( 5, 6, 7 );

    this.computeFaceNormals();

    function v( x, y, z ) {
        scope.vertices.push( new THREE.Vector3( x, y, z ) );
    }

    function f3( a, b, c ) {
        scope.faces.push( new THREE.Face3( a, b, c ) );
    }
};

Bird.prototype = Object.create( THREE.Geometry.prototype );
Bird.prototype.constructor = Bird;
