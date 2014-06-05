(function(){
    'use strict';

    var vPlane = [
        1.0,  1.0, 0.0,
        0.0,  1.0, 0.0,
        1.0,  0.0, 0.0,
        0.0,  0.0, 0.0
    ];

    var vLines = [
        0.0,  0.0, 0.0,
        1.0,  0.0, 0.0,

        1.0,  0.0, 0.0,
        1.0,  1.0, 0.0,

        1.0,  1.0, 0.0,
        0.0,  1.0, 0.0,

        0.0,  1.0, 0.0,
        0.0,  0.0, 0.0
    ];

    var canvas = document.getElementsByTagName('canvas')[0];
    var w = [ 256, 256 ];

    canvas.width = w[0];
    canvas.height = w[1];

    var gl = canvas.getContext('webgl');
    gl.viewport( -w[0], -w[1], w[0] * 2, w[1] * 2 );
    gl.clearColor( 0.0, 0.0, 1.0, 1.0 );

    /**
     * @param {Number[]} sz vec2
     * @constructor
     */
    function Texture( sz ) {
        var tex = gl.createTexture();
        gl.bindTexture( gl.TEXTURE_2D, tex );
        gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST );
        gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST );

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, sz[0], sz[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null );
        this.tex = tex;
        this.id = null;
    }

    /**
     * @returns {WebGLTexture}
     */
    Texture.prototype.get = function() {
        return this.tex;
    };

    /**
     * @param {Number} id
     */
    Texture.prototype.setSlot = function( id ) {
        this.id = id;
        gl.activeTexture( this.id );
        gl.bindTexture( gl.TEXTURE_2D, this.tex );
    };

    /**
     * @param {WebGLUniformLocation} uniform
     */
    Texture.prototype.assignUniform = function( uniform ) {
        if( this.id === null ) throw new Error('No slot assigned.');
        gl.uniform1i( uniform, this.id - gl.TEXTURE0 );
    };

    /**
     * @constructor
     */
    function Framebuffer() {
        this.fb = gl.createFramebuffer();
    }

    /**
     * void
     */
    Framebuffer.prototype.use = function() {
        gl.bindFramebuffer( gl.FRAMEBUFFER, this.fb );
    };

    /**
     * @param {Texture} tex
     */
    Framebuffer.prototype.target = function( tex ) {
        this.use();
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            tex.get(),
            0
        );
    };

    /**
     * @param id
     * @constructor
     */
    function Shader( id ) {
        var shaderScript = document.getElementById( id );
        if( !shaderScript ) {
            throw new Error( 'Shader by ID not found.' );
        }

        var source = '';
        var k = shaderScript.firstChild;
        while( k ) {
            if( k.nodeType == 3 ) source += k.textContent;
            k = k.nextSibling;
        }

        var types = {};
        types["x-shader/x-fragment"] = gl.FRAGMENT_SHADER;
        types["x-shader/x-vertex"] = gl.VERTEX_SHADER;
        var type = types[ shaderScript.type ];
        if( !type ) {
            throw new Error( 'Unknown shader type.' );
        }
        var shader = gl.createShader( type );

        gl.shaderSource( shader, source );
        gl.compileShader( shader );

        if( !gl.getShaderParameter( shader, gl.COMPILE_STATUS ) ) {
            console.log( id, gl.getShaderInfoLog( shader ) );
            throw new Error( 'Shader "' + id + '": ' + gl.getShaderInfoLog( shader ) );
        }

        this.shader = shader;
    }

    /**
     * @returns {WebGLShader}
     */
    Shader.prototype.get = function() {
        return this.shader;
    };

    /**
     * @constructor
     */
    var Program = function() {
        this.program = gl.createProgram();
    };

    /**
     * @param {WebGLShader} shader
     */
    Program.prototype.attach = function( shader ) {
        gl.attachShader( this.program, shader );
    };

    /**
     * void
     */
    Program.prototype.compile = function() {
        gl.linkProgram( this.program );

        if( !gl.getProgramParameter( this.program, gl.LINK_STATUS ) ) {
            throw new Error( 'Could not initialise shaders' );
        }
    };

    /**
     * void
     */
    Program.prototype.use = function() {
        gl.useProgram( this.program );
    };

    /**
     * @param {string} name
     * @returns {WebGLUniformLocation}
     */
    Program.prototype.uniform = function( name ) {
        return gl.getUniformLocation( this.program, name );
    };

    /**
     * @param {string} name
     * @returns {int}
     */
    Program.prototype.attrib = function( name ) {
        var result = gl.getAttribLocation( this.program, name );
        gl.enableVertexAttribArray( result );
        return result;
    };

    /**
     * @param {string} name
     * @param {Object} vocabulary uniform getters by name
     * @constructor
     */
    function NavierStokesPass( name, vocabulary ) {
        var scriptId = 'shader-' + name;

        var program = new Program();
        program.attach( new Shader( 'shader-vertex' ).get() );
        program.attach( new Shader( scriptId ).get() );
        program.compile();
        this.program = program;

        var script = document.getElementById( scriptId );

        var dataset = script.dataset;
        this.in = _( dataset['in'].split(',') ).map( function( x ) {
            return [ program.uniform( x ), vocabulary[ x ] ];
        } );
        this.out = vocabulary[ dataset['out'] ];

        this.name = name;
    }

    /**
     * @param {Framebuffer} fb
     * @param {WebGLBuffer} vbo
     */
    NavierStokesPass.prototype.use = function( fb, vbo ) {
        this.program.use();

        gl.bindBuffer( gl.ARRAY_BUFFER, vbo );
        gl.vertexAttribPointer( this.program.attrib('v'), 3, gl.FLOAT, false, 0, 0 );

        var that = this;

        _( this.in ).each( function( x ) {
            var uni = x[0]; // uniform location
            var f = x[1]; // value provider function
            var value = f();
            if( typeof value == 'number' ) {
                gl.uniform1f( uni, value );
            } else if( value instanceof Array && value.length == 2 ) {
                gl.uniform2f( uni, value[0], value[1] );
            } else if( value instanceof Texture ) {
                value.assignUniform( uni );
            } else {
                throw new Error( 'Unhandled uniform value type ' + typeof value );
            }
        } );

        fb.target( this.out() );

        gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
    };


    var velocity = new Texture( w );
    var pressure = new Texture( w );
    var tempcanv = new Texture( w );
    var carrier1 = new Texture( w );
    var carrier2 = new Texture( w );

    velocity.setSlot( gl.TEXTURE0 );
    pressure.setSlot( gl.TEXTURE1 );
    tempcanv.setSlot( gl.TEXTURE2 );
    carrier1.setSlot( gl.TEXTURE3 );
    carrier2.setSlot( gl.TEXTURE4 );

    var last = [ 0, 0 ];
    var mouse = [ 0, 0 ];

    document.addEventListener( 'mousemove', function( e ) {
        var x =     ( e.clientX || e.pageX ) / window.innerWidth;
        var y = 1 - ( e.clientY || e.pageY ) / window.innerHeight;
        mouse[0] = x - last[0];
        mouse[1] = y - last[1];
        last[0] = x;
        last[1] = y;
    }, false );

    mouse[0] *= 0.9;
    mouse[1] *= 0.9;

    var vocab = {
        velocity: function() { return velocity; },
        pressure: function() { return pressure; },
        tempcanv: function() { return tempcanv; },
        carrier1: function() { return carrier1; },
        carrier2: function() { return carrier2; },
        mouse:    function() { return mouse; },
        last:     function() { return last; },
        alpha:    function() { return 0.995; },
        beta:     function() { return ( 4 + 0.995 ) / 25.; }
    };

    var fb = new Framebuffer();

    var vboPlane = gl.createBuffer();
    vboPlane.itemSize = 3;
    gl.bindBuffer( gl.ARRAY_BUFFER, vboPlane );
    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vPlane ), gl.STATIC_DRAW );

    var vboLines = gl.createBuffer();
    vboLines.itemSize = 4;
    gl.bindBuffer( gl.ARRAY_BUFFER, vboLines );
    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vLines ), gl.STATIC_DRAW );

    var pBoundary = new Program();
    pBoundary.attach( new Shader( 'shader-vertex' ).get() );
    pBoundary.attach( new Shader( 'shader-boundary' ).get() );
    pBoundary.compile();
    var uBoundary = pBoundary.uniform( 'c' );

    var passes = [];

    passes.push( 'advect' );
    passes.push( 'advect-inverse' );

    passes.push( 'advect-velocity' );
    passes.push( 'jacobi' );
    for( var i = 0; i < 20; i++ ) {
        passes.push( 'inverse-jacobi' );
        passes.push( 'jacobi' );
    }
    passes.push( 'input' );
    passes.push( 'divergence' );
    passes.push( 'gradient' );

    var job = _.map( passes, function( x ) {
        return new NavierStokesPass( x, vocab );
    } );

    gl.bindBuffer( gl.ARRAY_BUFFER, vboPlane );
    gl.vertexAttribPointer( pBoundary.attrib('v'), 3, gl.FLOAT, false, 0, 0 );

    pBoundary.use();
    gl.uniform4f( uBoundary, 0.5, 0.5, 0.5, 1.0 );

    fb.target( vocab['velocity']() );
    gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );

    fb.target( vocab['pressure']() );
    gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );

    var render = function() {
        requestAnimationFrame( render );

        _( job ).each( function( pass ) {
            pass.use( fb, vboPlane );
        } );

        gl.bindFramebuffer( gl.FRAMEBUFFER, null );
        gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );

        pBoundary.use();
        gl.uniform4f( uBoundary, 0.5, 0.5, 0.5, 1.0 );

        gl.lineWidth( 10 );
        gl.bindBuffer( gl.ARRAY_BUFFER, vboLines );

        fb.target( vocab['velocity']() );
        gl.drawArrays( gl.LINES, 0, 4 );

        fb.target( vocab['pressure']() );
        gl.drawArrays( gl.LINES, 0, 4 );
    };
    render();

})();