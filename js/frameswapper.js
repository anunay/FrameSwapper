var FrameSwapper = function (settings) {
	var // required settings
		swapper = document.getElementById(settings.imgId),	// ID for the img tag to swap
		framesTotal = settings.framesTotal,					// total amount of frames
		nofParts = settings.nofParts,
		partDuration = settings.partDuration,				// how many frames per part/lap/step

		// optional settings
		partOffset = settings.partOffset || 0,				// offset where each part starts/stops
		popups = settings.popups || null,					// array with elements to display at certain frames
		direction = settings.direction || 'x',
		deferStateOnLoad = settings.deferStateOnLoad || false,// skip setting current state on load? if true, sets on first user interaction instead
		medResWidth = settings.medResWidth || 600,			// minimun width to load medium resolution frames
		hiResWidth = settings.hiResWidth || 1280,			// minimun width to load high resolution frames
		loResPath = settings.loResPath || 'frames-lo',		// paths to frame folders
		medResPath = settings.medResPath || 'frames-med',
		hiResPath = settings.hiResPath || 'frames-hi',
		parent = parent || document.getElementsByTagName('body')[0],	// parent to set current part class to

		// callbacks
		onLoadProgress = settings.onLoadProgress || null,
		onReady = settings.onReady || null,
		onResized = settings.onResized || null,
		onEnterPart = settings.onEnterPart || null,
		onLeavePart = settings.onLeavePart || null,

		// predefined
		dragging = false,
		progress = 0,
		dragDist = 0,
		lastX = 0,
		currentFrame = 0,
		swapperWidth = window.innerWidth, // swapper.offsetWidth, (didn't work in FF)
		isMobile = swapperWidth < medResWidth,
		currentPart, startDrag, stopDrag, diff, killInertia, panSpeed, resizeThrottle, cachedResolution,
		Frames = [];

	var preloadFrames = function (frameRate, folder, callbackEach, callbackTotal) {
		var Img = [],
			frameRate = frameRate || 1,
			folder = folder || getResolution(),
			loadAmount = frameRate == 1 ? framesTotal : Math.round(framesTotal / frameRate),
			loaded = 0;

		cachedResolution = folder;

		for (var i = 0; i <= framesTotal; i = i + frameRate) {
			Img[i] = new Image();

			// prepare load event
			Img[i].onload = function(){

				// store in frame array
				var index = this.getAttribute('data-index');
				Frames[index] = this.src;

				// update current frame
				setFrame();

				// run single image callback
				if (callbackEach) callbackEach(loaded, loadAmount, this);

				// run all images callback
				if (callbackTotal && loaded == loadAmount) callbackTotal(loaded, Img);

				loaded++;
				delete Img[i];
			};

			// start loading
			Img[i].setAttribute('data-index', i);
			Img[i].src = folder + '/' + i + '.jpg';
		}
	};

	var getPosition = function (event) {
		if(event.touches){
			// android
			return {
				x : event.touches[0].pageX,
				y : event.touches[0].pageY
			}
		} else {
			if(event.pageX !== undefined){
				// modern browser
				return {
					x : event.pageX,
					y : event.pageY
				}
			} else {
				// oldie
				return {
					x : event.clientX,
					y : event.clientY
				}
			}
		}
	};

	var startDrag = function (e) {
		e.preventDefault();
		dragging = true;
		startDrag = getPosition(e)[direction];
		killInertia = true;
		diff = 0;
	};

	var whileDrag = function (e) {
		if (!dragging) return;
		e.preventDefault();

		// check values
		dragDist = getPosition(e)[direction] - startDrag;
		diff = lastX - getPosition(e)[direction];
		lastX = getPosition(e)[direction];

		// update scene
		if (diff != 0) update(dragLimit(progress - dragDist));
	};

	var stopDrag = function (e) {
		if (dragging) {
			progress = dragLimit(progress - dragDist);
			dragging = false;

			// inertia?
			if (Math.abs(diff) > 4) inertia();
		}
	};

	var inertia = function (target, speed) {
		// calculate target based on last move diff?
		if (typeof target == 'undefined') target = dragLimit(progress + (diff * 10));
		speed = speed || 8;
		killInertia = false;
		inertiaRunning = true;

		var calc = function () {
			var step = Math.round((target - progress) / speed);
			if (!killInertia && step && progress != target) {
				progress += step;
				requestAnimationFrame(calc);
			}
			update();
		}
		calc();
	};

	var populate = function () {
		for (var i = 0, len = popups.length; i < len; i++) {
			popups[i].el = document.querySelector('.popup' + i);
			popups[i].active = false;
		}
	};

	var getFrameIndex = function (index) {
		// get closest available frame
		while (typeof Frames[index] == 'undefined' && index > 0) index--;

		// get path
		return Frames[index];
	};

	var setFrame = function (index) {
		if (typeof index != 'undefined') currentFrame = index;
		swapper.src = getFrameIndex(currentFrame);
	};

	var setPopup = function () {
		// experimental feature, not used in ck
		for (var i = 0, len = popups.length; i < len; i++) {
			var popup = popups[i];
			if (popup.start <= currentFrame && popup.start + popup.duration > currentFrame) {
				// in range
				if (!popup.active) {
					popup.el.classList.add('active');
					popup.active = true;
					console.log('activate popup ' + i)
				}

			} else {
				// out of range
				if (popup.active) {
					popup.el.classList.remove('active');
					popup.active = false;
					console.log('deactivate popup ' + i)
				}
			}
		}
	};

	var setPart = function () {
		if (currentFrame % (partDuration - 1) >= partOffset && currentFrame % (partDuration - 1) < partDuration - partOffset) {
			var newPart = Math.floor(currentFrame / partDuration) + 1;
		}

		if (currentPart != newPart) {
			// set class
			parent.classList.remove('part-' + currentPart);
			if (newPart) parent.classList.add('part-' + newPart);

			// run part callback on enter and leave
			if (newPart && onEnterPart) onEnterPart(newPart);
			else if (!newPart && currentPart && onLeavePart) onLeavePart(currentPart);

			currentPart = newPart;
		}
	};

	var dragLimit = function (frame) {
		if (frame < 0) return 0;
		else if (frame > framesTotal * panSpeed) return framesTotal * panSpeed;
		else return frame;
	};

	var update = function (pos) {
		var pos = typeof pos != 'undefined' ? pos : progress;

		// set "video" frame
		var frame = pos == 0 ? 0 : Math.round(pos / panSpeed);
		if (frame == currentFrame) return;

		setFrame(frame);

		// info popups
		if (!isMobile && popups) setPopup(currentFrame);
		if (partDuration) setPart();
	};

	var stepPart = function (dir) {
		// step +1 or -1
		var currentBag = Math.round((progress + partDuration/2) / (framesTotal * panSpeed) * nofParts),
			goTo = currentBag + dir;

		goToPart(goTo);
	};

	var goToPart = function (part) {
		// step to specific part
		killInertia = true;

		var goal = ((framesTotal * panSpeed) / framesTotal) * (part * partDuration - partDuration/2 - 1),
			speed = Math.abs(part-currentPart) * 12;

		if (speed > 24) speed = 24;

		// wait till next raf to make sure any current inertia loop is killed
		requestAnimationFrame(function(){
			inertia(dragLimit(goal), speed);
		});
	};

	var getResolution = function () {
		if (swapperWidth < medResWidth) return loResPath; 
		else if (swapperWidth > hiResWidth) return hiResPath; 
		else return medResPath;
	};

	var updateResolution = function () {
		// update resolution when resized from medium to hi or from low to anything
		var res = getResolution();
		if ((cachedResolution == medResPath && res == hiResPath) ||
			(cachedResolution == loResPath && res != loResPath)) preloadFrames();
	};

	var setSpeed = function () {
		panSpeed = Math.round(swapperWidth / 140);
	};

	var resize = function () {
		clearTimeout(resizeThrottle);
		resizeThrottle = setTimeout(function() {
			swapperWidth = window.innerWidth;
			updateResolution();
			setSpeed();
			update();

			if (onResized) onResized(swapperWidth, window.innerHeight);
		}, 200);
	};

	var init = function () {
		if (popups) populate();

		// set speed on load and on resize/orientation change
		setSpeed();
		window.addEventListener('resize', resize);

		// preload 1/4 lores or medres first for all clients
		var initialPreloadPath = swapperWidth < medResWidth ? loResPath : medResPath;

		preloadFrames(4, initialPreloadPath, onLoadProgress, function() {
			// set active part on load?
			if (!deferStateOnLoad) update();

			// drag handlers
			swapper.addEventListener('mousedown', startDrag);
			swapper.addEventListener('touchstart', startDrag);

			document.addEventListener('mousemove', whileDrag);
			document.addEventListener('touchmove', whileDrag);

			document.addEventListener('mouseup', stopDrag);
			document.addEventListener('touchend', stopDrag);

			// onReady from settings
			if (onReady) onReady();

			// keep preloading all frames in appropriate resolution
			preloadFrames();
		});
	};

	// init and return public methods
	init();

	return {
		stepPart: stepPart,
		goToPart: goToPart,
		currentFrame: function() { return currentFrame; }
	};
};
