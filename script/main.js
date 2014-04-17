(function(){
    'use strict';

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera( 75, 1, 0.1, 10000 );
    camera.position.x = 30;
    camera.position.y = 30;
    camera.lookAt( {
        x: 0,
        y: 0,
        z: 0
    } );

    var renderer = new THREE.WebGLRenderer();
    renderer.setSize( 100, 100 );
    renderer.shadowMapEnabled = true;

    var resize = function() {
        var sx = document.documentElement.clientWidth;
        var sy = document.documentElement.clientHeight;

        camera.aspect = sx / sy;
        camera.updateProjectionMatrix();

        renderer.setSize( sx, sy );
    };

    window.addEventListener( 'resize', resize, false );
    resize();

    document.body.appendChild( renderer.domElement );

    var material = new THREE.MeshPhongMaterial( { ambient: 0x030303, color: 0xdddddd, specular: 0xffffff, shininess: 30, shading: THREE.SmoothShading } );

    var mesh = new THREE.Mesh( new THREE.TorusKnotGeometry( 10, 3, 192, 32 ), material );
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add( mesh );

    var plane = new THREE.Mesh( new THREE.PlaneGeometry( 1000, 1000, 1, 1 ), material );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -15;
    plane.receiveShadow = true;

    scene.add( plane );

    var light = new THREE.DirectionalLight( 0xffffff, 0.5 );
    light.position.set( 0, 100, 100 );
    light.castShadow = true;
    light.shadowDarkness = 0.9;

    light.shadowMapWidth = 1024;
    light.shadowMapHeight = 1024;
    light.shadowCameraTop = 25;
    light.shadowCameraRight = 25;
    light.shadowCameraBottom = -25;
    light.shadowCameraLeft = -25;
    light.shadowCameraFar = 1000;

    scene.add( light );

    function render() {
        mesh.rotation.x += 0.01;
        mesh.rotation.y += 0.01;

        requestAnimationFrame( render );
        renderer.render( scene, camera );
    }
    render();
})();