/**
 * Created by Phoenix on 2015/12/29.
 */

function Path(start, end) {

    var lineMaterial = new THREE.LineBasicMaterial({
        color: 0xFF00ff
    });

    var v_diff = new THREE.Vector3();
    v_diff.subVectors(start, end);
    if (v_diff.length() < 0.1)
        return;

    var g = new THREE.Geometry();
    g.vertices.push(end);
    g.vertices.push(start);

    this.pathMesh = new THREE.Line(g, lineMaterial);
    g.dispose();
}
