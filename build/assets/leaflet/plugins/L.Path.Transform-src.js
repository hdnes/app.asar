/**
 * Leaflet vector features drag functionality
 * @author Alexander Milevski <info@w8r.name>
 * @preserve
 */

/**
 * Matrix transform path for SVG/VML
 * Renderer-independent
 */
L.Path.include({

	/**
	 * Applies matrix transformation to SVG
	 * @param {Array.<Number>?} matrix
	 */
	_transform: function(matrix) {
		if (this._renderer) {
			if (matrix) {
				this._renderer.transformPath(this, matrix);
			} else {
				// reset transform matrix
				this._renderer._resetTransformPath(this);
				this._update();
			}
		}
		return this;
	},

	/**
	 * Check if the feature was dragged, that'll supress the click event
	 * on mouseup. That fixes popups for example
	 *
	 * @param  {MouseEvent} e
	 */
	_onMouseClick: function(e) {
		if ((this.dragging && this.dragging.moved()) ||
			(this._map.dragging && this._map.dragging.moved())) {
			return;
		}

		this._fireMouseEvent(e);
	}

});
/**
 * Drag handler
 * @class L.Path.Drag
 * @extends {L.Handler}
 */
L.Handler.PathDrag = L.Handler.extend( /** @lends  L.Path.Drag.prototype */ {

  statics: {
    DRAGGING_CLS: 'leaflet-path-draggable',
  },


  /**
   * @param  {L.Path} path
   * @constructor
   */
  initialize: function(path) {

    /**
     * @type {L.Path}
     */
    this._path = path;

    /**
     * @type {Array.<Number>}
     */
    this._matrix = null;

    /**
     * @type {L.Point}
     */
    this._startPoint = null;

    /**
     * @type {L.Point}
     */
    this._dragStartPoint = null;

    /**
     * @type {Boolean}
     */
    this._mapDraggingWasEnabled = false;

  },

  /**
   * Enable dragging
   */
  addHooks: function() {
    this._path.on('mousedown', this._onDragStart, this);

    this._path.options.className = this._path.options.className ?
        (this._path.options.className + ' ' + L.Handler.PathDrag.DRAGGING_CLS) :
         L.Handler.PathDrag.DRAGGING_CLS;

    if (this._path._path) {
      L.DomUtil.addClass(this._path._path, L.Handler.PathDrag.DRAGGING_CLS);
    }
  },

  /**
   * Disable dragging
   */
  removeHooks: function() {
    this._path.off('mousedown', this._onDragStart, this);

    this._path.options.className = this._path.options.className
      .replace(new RegExp('\\s+' + L.Handler.PathDrag.DRAGGING_CLS), '');
    if (this._path._path) {
      L.DomUtil.removeClass(this._path._path, L.Handler.PathDrag.DRAGGING_CLS);
    }
  },

  /**
   * @return {Boolean}
   */
  moved: function() {
    return this._path._dragMoved;
  },

  /**
   * Start drag
   * @param  {L.MouseEvent} evt
   */
  _onDragStart: function(evt) {
    var eventType = evt.originalEvent._simulated ? 'touchstart' : evt.originalEvent.type;

    this._mapDraggingWasEnabled = false;
    this._startPoint = evt.containerPoint.clone();
    this._dragStartPoint = evt.containerPoint.clone();
    this._matrix = [1, 0, 0, 1, 0, 0];
    L.DomEvent.stop(evt.originalEvent);

    L.DomUtil.addClass(this._path._renderer._container, 'leaflet-interactive');
    L.DomEvent
      .on(document, L.Draggable.MOVE[eventType], this._onDrag, this)
      .on(document, L.Draggable.END[eventType], this._onDragEnd, this);

    if (this._path._map.dragging.enabled()) {
      // I guess it's required because mousdown gets simulated with a delay
      this._path._map.dragging._draggable._onUp();

      this._path._map.dragging.disable();
      this._mapDraggingWasEnabled = true;
    }
    this._path._dragMoved = false;

    if (this._path._popup) { // that might be a case on touch devices as well
      this._path._popup._close();
    }

    this._replaceCoordGetters(evt);
  },

  /**
   * Dragging
   * @param  {L.MouseEvent} evt
   */
  _onDrag: function(evt) {
    L.DomEvent.stop(evt);

    var first = (evt.touches && evt.touches.length >= 1 ? evt.touches[0] : evt);
    var containerPoint = this._path._map.mouseEventToContainerPoint(first);

    var x = containerPoint.x;
    var y = containerPoint.y;

    var dx = x - this._startPoint.x;
    var dy = y - this._startPoint.y;

    if (!this._path._dragMoved && (dx || dy)) {
      this._path._dragMoved = true;
      this._path.fire('dragstart', evt);
      // we don't want that to happen on click
      this._path.bringToFront();
    }

    this._matrix[4] += dx;
    this._matrix[5] += dy;

    this._startPoint.x = x;
    this._startPoint.y = y;

    this._path.fire('predrag', evt);
    this._path._transform(this._matrix);
    this._path.fire('drag', evt);
  },

  /**
   * Dragging stopped, apply
   * @param  {L.MouseEvent} evt
   */
  _onDragEnd: function(evt) {
    L.DomEvent.stop(evt);
    L.DomEvent._fakeStop({ type: 'click' });

    var containerPoint = this._path._map.mouseEventToContainerPoint(evt);

    // apply matrix
    if (this.moved()) {
      this._transformPoints(this._matrix);
      this._path._updatePath();
      this._path._project();
      this._path._transform(null);
    }

    L.DomEvent
      .off(document, 'mousemove touchmove', this._onDrag, this)
      .off(document, 'mouseup touchend',    this._onDragEnd, this);

    this._restoreCoordGetters();
    // consistency
    this._path.fire('dragend', {
      distance: Math.sqrt(
        L.LineUtil._sqDist(this._dragStartPoint, containerPoint)
      )
    });

    this._matrix         = null;
    this._startPoint     = null;
    this._dragStartPoint = null;

    if (this._mapDraggingWasEnabled) {
      this._path._map.dragging.enable();
    }
  },


  /**
   * Applies transformation, does it in one sweep for performance,
   * so don't be surprised about the code repetition.
   *
   * [ x ]   [ a  b  tx ] [ x ]   [ a * x + b * y + tx ]
   * [ y ] = [ c  d  ty ] [ y ] = [ c * x + d * y + ty ]
   *
   * @param {Array.<Number>} matrix
   */
  _transformPoints: function(matrix, dest) {
    var path = this._path;
    var i, len, latlng;

    var px = L.point(matrix[4], matrix[5]);

    var crs = path._map.options.crs;
    var transformation = crs.transformation;
    var scale = crs.scale(path._map.getZoom());
    var projection = crs.projection;

    var diff = transformation.untransform(px, scale)
      .subtract(transformation.untransform(L.point(0, 0), scale));
    var applyTransform = !dest;

    path._bounds = new L.LatLngBounds();

    // console.time('transform');
    // all shifts are in-place
    if (path._point) { // L.Circle
      dest = projection.unproject(
        projection.project(path._latlng)._add(diff));
      if (applyTransform) {
        path._latlng = dest;
        path._point._add(px);
      }
    } else if (path._rings || path._parts) { // everything else
      var rings   = path._rings || path._parts;
      var latlngs = path._latlngs;
      dest = dest || latlngs;
      if (!L.Util.isArray(latlngs[0])) { // polyline
        latlngs = [latlngs];
        dest    = [dest];
      }
      for (i = 0, len = rings.length; i < len; i++) {
        dest[i] = dest[i] || [];
        for (var j = 0, jj = rings[i].length; j < jj; j++) {
          latlng     = latlngs[i][j];
          dest[i][j] = projection
            .unproject(projection.project(latlng)._add(diff));
          if (applyTransform) {
            path._bounds.extend(latlngs[i][j]);
            rings[i][j]._add(px);
          }
        }
      }
    }
    return dest;
    // console.timeEnd('transform');
  },



  /**
   * If you want to read the latlngs during the drag - your right,
   * but they have to be transformed
   */
  _replaceCoordGetters: function() {
    if (this._path.getLatLng) { // Circle, CircleMarker
      this._path.getLatLng_ = this._path.getLatLng;
      this._path.getLatLng = L.Util.bind(function() {
        return this.dragging._transformPoints(this.dragging._matrix, {});
      }, this._path);
    } else if (this._path.getLatLngs) {
      this._path.getLatLngs_ = this._path.getLatLngs;
      this._path.getLatLngs = L.Util.bind(function() {
        return this.dragging._transformPoints(this.dragging._matrix, []);
      }, this._path);
    }
  },


  /**
   * Put back the getters
   */
  _restoreCoordGetters: function() {
    if (this._path.getLatLng_) {
      this._path.getLatLng = this._path.getLatLng_;
      delete this._path.getLatLng_;
    } else if (this._path.getLatLngs_) {
      this._path.getLatLngs = this._path.getLatLngs_;
      delete this._path.getLatLngs_;
    }
  }

});


/**
 * @param  {L.Path} layer
 * @return {L.Path}
 */
L.Handler.PathDrag.makeDraggable = function(layer) {
  layer.dragging = new L.Handler.PathDrag(layer);
  return layer;
};


/**
 * Also expose as a method
 * @return {L.Path}
 */
L.Path.prototype.makeDraggable = function() {
  return L.Handler.PathDrag.makeDraggable(this);
};


L.Path.addInitHook(function() {
  if (this.options.draggable) {
    // ensure interactive
    this.options.interactive = true;

    if (this.dragging) {
      this.dragging.enable();
    } else {
      L.Handler.PathDrag.makeDraggable(this);
      this.dragging.enable();
    }
  } else if (this.dragging) {
    this.dragging.disable();
  }
});
L.SVG.include({

	/**
	 * Reset transform matrix
	 */
	_resetTransformPath: function(layer) {
		layer._path.setAttributeNS(null, 'transform', '');
	},

	/**
	 * Applies matrix transformation to SVG
	 * @param {L.Path}         layer
	 * @param {Array.<Number>} matrix
	 */
	transformPath: function(layer, matrix) {
		layer._path.setAttributeNS(null, 'transform',
			'matrix(' + matrix.join(' ') + ')');
	}

});
L.SVG.include(!L.Browser.vml ? {} : {

	/**
	 * Reset transform matrix
	 */
	_resetTransformPath: function(layer) {
		if (layer._skew) {
			// super important! workaround for a 'jumping' glitch:
			// disable transform before removing it
			layer._skew.on = false;
			layer._path.removeChild(layer._skew);
			layer._skew = null;
		}
	},

	/**
	 * Applies matrix transformation to VML
	 * @param {L.Path}         layer
	 * @param {Array.<Number>} matrix
	 */
	transformPath: function(layer, matrix) {
		var skew = layer._skew;

		if (!skew) {
			skew = L.SVG.create('skew');
			layer._path.appendChild(skew);
			skew.style.behavior = 'url(#default#VML)';
			layer._skew = skew;
		}

		// handle skew/translate separately, cause it's broken
		var mt = matrix[0].toFixed(8) + ' ' + matrix[1].toFixed(8) + ' ' +
			matrix[2].toFixed(8) + ' ' + matrix[3].toFixed(8) + ' 0 0';
		var offset = Math.floor(matrix[4]).toFixed() + ', ' +
			Math.floor(matrix[5]).toFixed() + '';

		var s = this._path.style;
		var l = parseFloat(s.left);
		var t = parseFloat(s.top);
		var w = parseFloat(s.width);
		var h = parseFloat(s.height);

		if (isNaN(l)) { l = 0; }
		if (isNaN(t)) { t = 0; }
		if (isNaN(w) || !w) { w = 1; }
		if (isNaN(h) || !h) { h = 1; }

		var origin = (-l / w - 0.5).toFixed(8) + ' ' + (-t / h - 0.5).toFixed(8);

		skew.on = 'f';
		skew.matrix = mt;
		skew.origin = origin;
		skew.offset = offset;
		skew.on = true;
	}

});
L.Util.trueFn = function() {
  return true;
};

L.Canvas.include({

  /**
   * Do nothing
   * @param  {L.Path} layer
   */
  _resetTransformPath: function(layer) {
    if (!this._containerCopy) {
      return;
    }

    delete this._containerCopy;

    if (layer._containsPoint_) {
      layer._containsPoint = layer._containsPoint_;
      delete layer._containsPoint_;

      this._requestRedraw(layer);
      this._draw(true);
    }
  },

  /**
   * Algorithm outline:
   *
   * 1. pre-transform - clear the path out of the canvas, copy canvas state
   * 2. at every frame:
   *    2.1. save
   *    2.2. redraw the canvas from saved one
   *    2.3. transform
   *    2.4. draw path
   *    2.5. restore
   *
   * @param  {L.Path} layer
   * @param  {Array.<Number>} matrix
   */
  transformPath: function(layer, matrix) {
    var copy = this._containerCopy;
    var ctx = this._ctx;
    var m = L.Browser.retina ? 2 : 1;
    var bounds = this._bounds;
    var size = bounds.getSize();
    var pos = bounds.min;

    if (!copy) {
      copy = this._containerCopy = document.createElement('canvas');
      document.body.appendChild(copy);

      copy.width = m * size.x;
      copy.height = m * size.y;

      layer._removed = true;
      this._redraw();

      copy.getContext('2d').translate(m * bounds.min.x, m * bounds.min.y);
      copy.getContext('2d').drawImage(this._container, 0, 0);
      this._initPath(layer);
      layer._containsPoint_ = layer._containsPoint;
      layer._containsPoint = L.Util.trueFn;
    }

    ctx.save();
    ctx.clearRect(pos.x, pos.y, size.x * m, size.y * m);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();
    ctx.save();

    ctx.drawImage(this._containerCopy, 0, 0, size.x, size.y);
    ctx.transform.apply(ctx, matrix);

    var layers = this._layers;
    this._layers = {};

    this._initPath(layer);
    layer._updatePath();

    this._layers = layers;
    ctx.restore();
  }

});
/**
 * Drag/rotate/resize handler for [leaflet](http://leafletjs.com) vector features.
 *
 * @author Alexander Milevski <info@w8r.name>
 * @license MIT
 * @preserve
 */
/**
 * Point on the line segment or its extention
 *
 * @param  {L.Point} start
 * @param  {L.Point} final
 * @param  {Number}  distPx
 * @return {L.Point}
 */
L.LineUtil.pointOnLine = function(start, final, distPx) {
  var ratio = 1 + distPx / start.distanceTo(final);
  return new L.Point(
    start.x + (final.x - start.x) * ratio,
    start.y + (final.y - start.y) * ratio
  );
};


/**
 * Deep merge objects.
 */
L.Util.merge = function() {
  var i = 1;
  var key, val;
  var obj = arguments[i];

  function isObject(object) {
    return Object.prototype.toString.call(object) === '[object Object]';
  }

  // make sure we don't modify source element and it's properties
  // objects are passed by reference
  var target = arguments[0];

  while (obj) {
    obj = arguments[i++];
    for (key in obj) {
      if (!obj.hasOwnProperty(key)) {
        continue;
      }

      val = obj[key];

      if (isObject(val) && isObject(target[key])){
        target[key] = L.Util.merge(target[key], val);
      } else {
        target[key] = val;
      }
    }
  }
  return target;
};
/**
 * @class  L.Matrix
 *
 * @param {Number} a
 * @param {Number} b
 * @param {Number} c
 * @param {Number} d
 * @param {Number} e
 * @param {Number} f
 */
L.Matrix = function(a, b, c, d, e, f) {

  /**
   * @type {Array.<Number>}
   */
  this._matrix = [a, b, c, d, e, f];
};


L.Matrix.prototype = {


  /**
   * @param  {L.Point} point
   * @return {L.Point}
   */
  transform: function(point) {
    return this._transform(point.clone());
  },


  /**
   * Destructive
   *
   * [ x ] = [ a  b  tx ] [ x ] = [ a * x + b * y + tx ]
   * [ y ] = [ c  d  ty ] [ y ] = [ c * x + d * y + ty ]
   *
   * @param  {L.Point} point
   * @return {L.Point}
   */
  _transform: function(point) {
    var matrix = this._matrix;
    var x = point.x, y = point.y;
    point.x = matrix[0] * x + matrix[1] * y + matrix[4];
    point.y = matrix[2] * x + matrix[3] * y + matrix[5];
    return point;
  },


  /**
   * @param  {L.Point} point
   * @return {L.Point}
   */
  untransform: function (point) {
    var matrix = this._matrix;
    return new L.Point(
      (point.x / matrix[0] - matrix[4]) / matrix[0],
      (point.y / matrix[2] - matrix[5]) / matrix[2]
    );
  },


  /**
   * @return {L.Matrix}
   */
  clone: function() {
    var matrix = this._matrix;
    return new L.Matrix(
      matrix[0], matrix[1], matrix[2],
      matrix[3], matrix[4], matrix[5]
    );
  },


  /**
   * @param {L.Point=|Number=} translate
   * @return {L.Matrix|L.Point}
   */
  translate: function(translate) {
    if (translate === undefined) {
      return new L.Point(this._matrix[4], this._matrix[5]);
    }

    var translateX, translateY;
    if (typeof translate === 'number') {
      translateX = translateY = translate;
    } else {
      translateX = translate.x;
      translateY = translate.y;
    }

    return this._add(1, 0, 0, 1, translateX, translateY);
  },


  /**
   * @param {L.Point=|Number=} scale
   * @return {L.Matrix|L.Point}
   */
  scale: function(scale, origin) {
    if (scale === undefined) {
      return new L.Point(this._matrix[0], this._matrix[3]);
    }

    var scaleX, scaleY;
    origin = origin || L.point(0, 0);
    if (typeof scale === 'number') {
      scaleX = scaleY = scale;
    } else {
      scaleX = scale.x;
      scaleY = scale.y;
    }

    return this
      ._add(scaleX, 0, 0, scaleY, origin.x, origin.y)
      ._add(1, 0, 0, 1, -origin.x, -origin.y);
  },


  /**
   * m00  m01  x - m00 * x - m01 * y
   * m10  m11  y - m10 * x - m11 * y
   * @param {Number}   angle
   * @param {L.Point=} origin
   * @return {L.Matrix}
   */
  rotate: function(angle, origin) {
    var cos = Math.cos(angle);
    var sin = Math.sin(angle);

    origin = origin || new L.Point(0, 0);

    return this
      ._add(cos, sin, -sin, cos, origin.x, origin.y)
      ._add(1, 0, 0, 1, -origin.x, -origin.y);
  },


  /**
   * Invert rotation
   * @return {L.Matrix}
   */
  flip: function() {
    this._matrix[1] *= -1;
    this._matrix[2] *= -1;
    return this;
  },


  /**
   * @param {Number|L.Matrix} a
   * @param {Number} b
   * @param {Number} c
   * @param {Number} d
   * @param {Number} e
   * @param {Number} f
   */
  _add: function(a, b, c, d, e, f) {
    var result = [[], [], []];
    var src = this._matrix;
    var m = [
      [src[0], src[2], src[4]],
      [src[1], src[3], src[5]],
      [     0,      0,     1]
    ];
    var other = [
      [a, c, e],
      [b, d, f],
      [0, 0, 1]
    ], val;


    if (a && a instanceof L.Matrix) {
      src = a._matrix;
      other = [
        [src[0], src[2], src[4]],
        [src[1], src[3], src[5]],
        [     0,      0,     1]];
    }

    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) {
        val = 0;
        for (var k = 0; k < 3; k++) {
          val += m[i][k] * other[k][j];
        }
        result[i][j] = val;
      }
    }

    this._matrix = [
      result[0][0], result[1][0], result[0][1],
      result[1][1], result[0][2], result[1][2]
    ];
    return this;
  }


};


L.matrix = function(a, b, c, d, e, f) {
  return new L.Matrix(a, b, c, d, e, f);
};
L.Handler.PathTransform = L.Handler.extend({

  options: {
    rotation: true,
    scaling:  true,

    // edge handlers
    handlerOptions: {
      radius:      5,
      fillColor:   '#ffffff',
      color:       '#202020',
      fillOpacity: 1,
      weight:      2,
      opacity:     0.7
    },

    // rectangle
    boundsOptions: {
      weight:    1,
      opacity:   1,
      dashArray: [3, 3],
      fill:      false
    },

    // rotation handler
    rotateHandleOptions: {
      weight: 1,
      opacity: 1
    },
    // rotation handle length
    handleLength: 20,

    // maybe I'll add skewing in the future
    edgesCount:   4
  },


  /**
   * @class L.Handler.PathTransform
   * @constructor
   * @param  {L.Path} path
   */
  initialize: function(path) {
    // references
    this._path = path;
    this._map  = null;

    // handlers
    this._activeMarker   = null;
    this._originMarker   = null;
    this._rotationMarker = null;

    // origins & temporary state
    this._rotationOrigin   = null;
    this._scaleOrigin      = null;
    this._angle            = 0;
    this._scale            = L.point(1, 1);
    this._initialDist      = 0;
    this._rotationStart    = null;
    this._rotationOriginPt = null;

    // preview and transform matrix
    this._matrix          = new L.Matrix(1, 0, 0, 1, 0, 0);
    this._projectedMatrix = new L.Matrix(1, 0, 0, 1, 0, 0);

    // ui elements
    this._handlersGroup  = null;
    this._rect           = null;
    this._handlers       = [];
    this._handleLine     = null;
  },


  /**
   * If the polygon is not rendered, you can transform it yourself
   * in the coordinates, and do it properly.
   * @param {Object=} options
   */
  enable: function(options) {
    if (this._path._map) {
      this._map = this._path._map;
      if (options) {
        this.setOptions(options);
      }
      L.Handler.prototype.enable.call(this);
    }
  },


  /**
   * Init interactions and handlers
   */
  addHooks: function() {
    this._createHandlers();
    this._path
      .on('dragstart', this._onDragStart, this)
      .on('dragend',   this._onDragEnd, this);
  },


  /**
   * Remove handlers
   */
  removeHooks: function() {
    this._hideHandlers();
    this._handlersGroup = null;
    this._rect = null;
    this._handlers = [];
  },


  /**
   * Change editing options
   * @param {Object} options
   */
  setOptions: function(options) {
    var enabled = this._enabled;
    if (enabled) {
      this.disable();
    }

    this.options = L.Util.merge({},
      JSON.parse(JSON.stringify(L.Handler.PathTransform.prototype.options)),
      options);

    if (enabled) {
      this.enable();
    }

    return this;
  },


  /**
   * Update the polygon and handlers preview, no reprojection
   */
  _update: function() {
    var matrix = this._matrix;

    // update handlers
    for (var i = 0, len = this._handlers.length; i < len; i++) {
      var handler = this._handlers[i];
      if (handler !== this._originMarker) {
        handler._point = matrix.transform(handler._initialPoint);
        handler._updatePath();
      }
    }

    matrix = matrix.clone().flip();

    this._applyTransform(matrix);
    this._path.fire('transform', { layer: this._path });
  },


  /**
   * @param  {L.Matrix} matrix
   */
  _applyTransform: function(matrix) {
    this._path._transform(matrix._matrix);
    this._rect._transform(matrix._matrix);

    if (this.options.rotation) {
      this._handleLine._transform(matrix._matrix);
    }
  },


  /**
   * Apply final transformation
   */
  _apply: function() {
    //console.group('apply transform');
    var map = this._map;
    var matrix = this._matrix.clone();
    var angle = this._angle;
    var scale = this._scale.clone();

    this._transformGeometries();

    // update handlers
    for (var i = 0, len = this._handlers.length; i < len; i++) {
      var handler = this._handlers[i];
      handler._latlng = map.layerPointToLatLng(handler._point);
      delete handler._initialPoint;
      handler.redraw();
    }

    this._matrix = L.matrix(1, 0, 0, 1, 0, 0);
    this._scale  = L.point(1, 1);
    this._angle  = 0;

    this._updateHandlers();

    map.dragging.enable();
    this._path.fire('transformed', {
      matrix: matrix,
      scale: scale,
      rotation: angle,
      // angle: angle * (180 / Math.PI),
      layer: this._path
    });
    // console.groupEnd('apply transform');
  },


  /**
   * Recalculate rotation handlers position
   */
  _updateHandlers: function() {
    var handlersGroup = this._handlersGroup;

    this._rectShape = this._rect.toGeoJSON();

    handlersGroup.removeLayer(this._handleLine);
    handlersGroup.removeLayer(this._rotationMarker);

    this._handleLine = this._rotationMarker = null;

    for (var i = this._handlers.length - 1; i >= 0; i--) {
      handlersGroup.removeLayer(this._handlers[i]);
    }

    this._createHandlers();
  },


  /**
   * Transform geometries separately
   */
  _transformGeometries: function() {
    var origin = this._origin;
    this._path._transform(null);
    this._rect._transform(null);

    this._transformPoints(this._path, this._matrix, origin);
    this._transformPoints(this._rect, this._matrix, origin);

    if (this.options.rotation) {
      this._handleLine._transform(null);
      this._transformPoints(this._handleLine, this._matrix, origin);
    }
  },


  /**
   * @inheritDoc
   */
  _getProjectedMatrix: function(matrix, originPoint) {
    var map    = this._map;
    var zoom   = map.getMaxZoom();
    var matrix = L.matrix(1, 0, 0, 1, 0, 0);
    var origin;

    if (this._angle) {
      origin = map.project(this._rotationOrigin, zoom);
      matrix = matrix.rotate(this._angle, origin).flip();
    }

    if (!(this._scale.x === 1 && this._scale.y === 1)) {
      origin = map.project(this._scaleOrigin, zoom);
      matrix = matrix
        ._add(L.matrix(1, 0, 0, 1, origin.x, origin.y))
        ._add(L.matrix(this._scale.x, 0, 0, this._scale.y, 0, 0))
        ._add(L.matrix(1, 0, 0, 1, -origin.x, -origin.y));
    }

    return matrix;
  },


  /**
   * @param  {L.LatLng} latlng
   * @param  {L.Matrix} matrix
   * @param  {L.Map}    map
   * @param  {Number}   zoom
   * @return {L.LatLng}
   */
  _transformPoint: function(latlng, matrix, map, zoom) {
    return map.unproject(matrix.transform(
      map.project(latlng, zoom)), zoom);
  },


  /**
   * Applies transformation, does it in one sweep for performance,
   * so don't be surprised about the code repetition.
   *
   * @param {L.Path}   path
   * @param {L.Matrix} matrix
   */
  _transformPoints: function(path, matrix, origin) {
    var map = path._map;
    var zoom = map.getMaxZoom();
    var i, len;

    var projectedMatrix = this._projectedMatrix = this._getProjectedMatrix();
    // console.time('transform');

    // all shifts are in-place
    if (path._point) { // L.Circle
      path._latlng = this._transformPoint(
        path._latlng, projectedMatrix, map, zoom);
    } else if (path._rings || path._parts) { // everything else
      var rings = path._rings;
      var latlngs = path._latlngs;
      path._bounds = new L.LatLngBounds();

      if (!L.Util.isArray(latlngs[0])) { // polyline
        latlngs = [latlngs];
      }
      for (i = 0, len = rings.length; i < len; i++) {
        for (var j = 0, jj = rings[i].length; j < jj; j++) {
          latlngs[i][j] = this._transformPoint(
            latlngs[i][j], projectedMatrix, map, zoom);
          path._bounds.extend(latlngs[i][j]);
        }
      }
    }

    path._reset();
    //console.timeEnd('transform');
  },


  /**
   * Creates markers and handles
   */
  _createHandlers: function() {
    var map = this._map;
    this._handlersGroup = this._handlersGroup ||
                          new L.LayerGroup().addTo(map);
    this._rect = this._rect ||
                   this._getBoundingPolygon().addTo(this._handlersGroup);

    if (this.options.scaling) {
      this._handlers = [];
      for (var i = 0; i < this.options.edgesCount; i++) {
        // TODO: add stretching
        this._handlers.push(
          this._createHandler(this._rect._latlngs[0][i], i * 2, i)
          .addTo(this._handlersGroup));
      }
    }

    // add bounds
    if (this.options.rotation) {
      //add rotation handler
      this._createRotationHandlers();
    }
  },


  /**
   * Rotation marker and small connectin handle
   */
  _createRotationHandlers: function() {
    var map     = this._map;
    var latlngs = this._rect._latlngs[0];

    var bottom   = new L.LatLng(
      (latlngs[0].lat + latlngs[3].lat) / 2,
      (latlngs[0].lng + latlngs[3].lng) / 2);
    // hehe, top is a reserved word
    var topPoint = new L.LatLng(
      (latlngs[1].lat + latlngs[2].lat) / 2,
      (latlngs[1].lng + latlngs[2].lng) / 2);

    var handlerPosition = map.layerPointToLatLng(
      L.LineUtil.pointOnLine(
        map.latLngToLayerPoint(bottom),
        map.latLngToLayerPoint(topPoint),
        this.options.handleLength)
    );

    this._handleLine = new L.Polyline([topPoint, handlerPosition],
      this.options.rotateHandleOptions).addTo(this._handlersGroup);
    this._rotationMarker = new L.CircleMarker(handlerPosition,
      this.options.handlerOptions)
      .addTo(this._handlersGroup)
      .on('mousedown', this._onRotateStart, this);

    this._rotationOrigin = new L.LatLng(
      (topPoint.lat + bottom.lat) / 2,
      (topPoint.lng + bottom.lng) / 2
    );

    this._handlers.push(this._rotationMarker);
  },


  /**
   * @return {L.LatLng}
   */
  _getRotationOrigin: function() {
    var latlngs = this._rect._latlngs[0];
    var lb = latlngs[0];
    var rt = latlngs[2];

    return new L.LatLng(
      (lb.lat + rt.lat) / 2,
      (lb.lng + rt.lng) / 2
    );
  },


  /**
   * Secure the rotation origin
   * @param  {Event} evt
   */
  _onRotateStart: function(evt) {
    var map = this._map;

    map.dragging.disable();

    this._originMarker     = null;
    this._rotationOriginPt = map.latLngToLayerPoint(this._getRotationOrigin());
    this._rotationStart    = evt.layerPoint;
    this._initialMatrix    = this._matrix.clone();

    this._angle = 0;
    this._path._map
      .on('mousemove', this._onRotate,     this)
      .on('mouseup',   this._onRotateEnd, this);

    this._cachePoints();
    this._path
      .fire('transformstart',   { layer: this._path })
      .fire('rotatestart', { layer: this._path, rotation: 0 });
  },


  /**
   * @param  {Event} evt
   */
  _onRotate: function(evt) {
    var pos = evt.layerPoint;
    var previous = this._rotationStart;
    var origin   = this._rotationOriginPt;

    // rotation step angle
    this._angle = Math.atan2(pos.y - origin.y, pos.x - origin.x) -
                  Math.atan2(previous.y - origin.y, previous.x - origin.x);

    this._matrix = this._initialMatrix
      .clone()
      .rotate(this._angle, origin)
      .flip();

    this._update();
    this._path.fire('rotate', { layer: this._path, rotation: this._angle });
  },


  /**
   * @param  {Event} evt
   */
  _onRotateEnd: function(evt) {
    this._path._map
      .off('mousemove', this._onRotate, this)
      .off('mouseup',   this._onRotateEnd, this);

    this._apply();
    this._path.fire('rotateend', { layer: this._path, rotation: this._angle });
  },


  /**
   * @param  {Event} evt
   */
  _onScaleStart: function(evt) {
    var marker = evt.target;
    var map = this._map;

    map.dragging.disable();

    this._activeMarker = marker;

    this._originMarker = this._handlers[(marker.options.index + 2) % 4];
    this._scaleOrigin  = this._originMarker.getLatLng();

    this._initialMatrix = this._matrix.clone();
    this._cachePoints();

    this._map
      .on('mousemove', this._onScale,    this)
      .on('mouseup',   this._onScaleEnd, this);
    this._initialDist = this._originMarker._point
      .distanceTo(this._activeMarker._point);

    this._path
      .fire('transformstart', { layer: this._path })
      .fire('scalestart', { layer: this._path, scale: L.point(1, 1) });
  },


  /**
   * @param  {Event} evt
   */
  _onScale: function(evt) {
    var originPoint = this._originMarker._point;
    var ratio = originPoint.distanceTo(evt.layerPoint) / this._initialDist;

    this._scale = new L.Point(ratio, ratio);

    // update matrix
    this._matrix = this._initialMatrix
      .clone()
      .scale(ratio, originPoint);

    this._update();
    this._path.fire('scale', {
      layer: this._path, scale: this._scale.clone() });
  },


  /**
   * Scaling complete
   * @param  {Event} evt
   */
  _onScaleEnd: function(evt) {
    this._map
      .off('mousemove', this._onScale,    this)
      .off('mouseup',   this._onScaleEnd, this);

    this._apply();
    this._path.fire('scaleend', {
      layer: this._path, scale: this._scale.clone() });
  },


  /**
   * Cache current handlers positions
   */
  _cachePoints: function() {
    this._handlersGroup.eachLayer(function(layer) {
      layer.bringToFront();
    });
    for (var i = 0, len = this._handlers.length; i < len; i++) {
      var handler = this._handlers[i];
      handler._initialPoint = handler._point.clone();
    }
  },


  /**
   * Bounding polygon
   * @return {L.Polygon}
   */
  _getBoundingPolygon: function() {
    if (this._rectShape) {
      return L.GeoJSON.geometryToLayer(
        this._rectShape, null, null, this.options.boundsOptions);
    } else {
      return new L.Rectangle(
        this._path.getBounds(), this.options.boundsOptions);
    }
  },


  /**
   * Create corner marker
   * @param  {L.LatLng} latlng
   * @param  {Number}   type one of L.Handler.PathScale.HandlerTypes
   * @param  {Number}   index
   * @return {L.CircleMarker}
   */
  _createHandler: function(latlng, type, index) {
    var marker = new L.CircleMarker(latlng,
      L.Util.extend(this.options.handlerOptions, {
        type: type,
        index: index
      })
    );

    marker.on('mousedown', this._onScaleStart, this);
    return marker;
  },


  /**
   * Hide(not remove) the handlers layer
   */
  _hideHandlers: function() {
    this._map.removeLayer(this._handlersGroup);
  },


  /**
   * Hide handlers and rectangle
   */
  _onDragStart: function() {
    this._hideHandlers();
  },


  /**
   * Drag rectangle, re-create handlers
   */
  _onDragEnd: function(evt) {
    var rect = this._rect;
    var matrix = (evt.layer ? evt.layer : this._path).dragging._matrix.slice();

    if (!rect.dragging) {
      rect.dragging = new L.Handler.PathDrag(rect);
    }
    rect.dragging.enable();
    this._map.addLayer(rect);
    rect.dragging._transformPoints(matrix);
    rect._updatePath();
    rect._project();
    rect.dragging.disable();

    this._map.addLayer(this._handlersGroup);
    this._updateHandlers();

    this._path.fire('transformed', {
      scale: L.point(1, 1),
      rotation: 0,
      matrix: L.matrix.apply(undefined, matrix),
      translate: L.point(matrix[4], matrix[5]),
      layer: this._path
    });
  }
});

L.Path.addInitHook(function() {
  if (this.options.transform) {
    this.transform = new L.Handler.PathTransform(this, this.options.transform);
  }
});
