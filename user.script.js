// ==UserScript==
// @name         Krunker AimBot ESP BHOP
// @namespace    https://github.com/JohnLhar/
// @version      1.8.9
// @description  Hacks
// @author       JohnLHar
// @match        *://krunker.io/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    const replace = String.prototype.replace;
    const original_call = Function.prototype.call;

    let anti_map = [];

    // hook toString to conceal all hooks
    const original_toString = Function.prototype.toString;
    let hook_toString = new Proxy(original_toString, {
        apply: function (target, _this, _arguments) {
            for (var i = 0; i < anti_map.length; i++) {
                if (anti_map[i].from === _this) {
                    return target.apply(anti_map[i].to, _arguments);
                }
            }
            return target.apply(_this, _arguments);
        }
    });
    // hide toString hook itself
    anti_map.push({
        from: hook_toString,
        to: original_toString
    });
    Function.prototype.toString = hook_toString;

    let conceal_function = function (original_Function, hook_Function) {
        anti_map.push({
            from: hook_Function,
            to: original_Function
        });
    };

    // hook Object.getOwnPropertyDescriptors to hide variables from window
    let hidden_globals = [];
    const original_getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors;
    let hook_getOwnPropertyDescriptors = new Proxy(original_getOwnPropertyDescriptors, {
        apply: function (target, _this, _arguments) {
            let descriptors = target.apply(_this, _arguments);
            for (var i = 0; i < hidden_globals.length; i++) {
                delete descriptors[hidden_globals[i]];
            }
            return descriptors;
        }
    });
    Object.getOwnPropertyDescriptors = hook_getOwnPropertyDescriptors;
    conceal_function(original_getOwnPropertyDescriptors, hook_getOwnPropertyDescriptors);

    let invisible_define = function (obj, key, value) {
        hidden_globals.push(key);
        Object.defineProperty(obj, key, {
            enumberable: false,
            configurable: false,
            writable: true,
            value: value
        });
    };

    let global_invisible_define = function (key, value) {
        invisible_define(window, key, value);
    };

    // we generate random keys for global variables and make it almost impossible(?)
    // for outsiders to find programatically
    let keyMap = {};
    let genKey = function () {
        // https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
        let a = new Uint8Array(20);
        crypto.getRandomValues(a);
        return 'hrt' + Array.from(a, x => ('0' + x.toString(16)).substr(-2)).join('');
    }

    keyMap['init'] = genKey();
    global_invisible_define(keyMap['init'], false);

    // drawVisuals gets overwritten later - place hook before anti cheat loads
    let drawVisuals = function () {};
    const original_clearRect = CanvasRenderingContext2D.prototype.clearRect;
    let hook_clearRect = new Proxy(original_clearRect, {
        apply: function (target, _this, _arguments) {
            target.apply(_this, _arguments);
            drawVisuals(_this);
        }
    });
    conceal_function(original_clearRect, hook_clearRect);
    CanvasRenderingContext2D.prototype.clearRect = hook_clearRect;

    // me, inputs, world, consts, math are objects the rest are key strings
    let hrtCheat = function (me, inputs, world, consts, math, canSee, pchObjc, objInstances, isYou, recoilAnimY, mouseDownL, mouseDownR) {
        /* re implements code that we overwrote to place hook */
        let controls = world.controls;
        if (controls.scrollDelta) {
            controls.skipScroll = controls.scrollToSwap;
            if (!controls.scrollToSwap) {
                controls.fakeKey(0x4e20, 0x1);
            }
        }
        controls.scrollDelta = 0;
        controls.wSwap = 0;
        /******************************************************/

        // aimbot
        const playerHeight = 11;
        const crouchDst = 3;
        const headScale = 2;
        const hitBoxPad = 1;
        const armScale = 1.3;
        const chestWidth = 2.6;
        const armInset = -.1;
        const playerScale = (2 * armScale + chestWidth + armInset) / 2;
        const SHOOT = 5,
            SCOPE = 6,
            xDr = 3,
            yDr = 2,
            JUMP = 7,
            CROUCH = 8;
        let isEnemy = function (player) {
            return !me.team || player.team != me.team
        };
        let canHit = function (player) {
            return null == world[canSee](me, player.x3, player.y3 - player.crouchVal * crouchDst, player.z3)
        };
        let normaliseYaw = function (yaw) {
            return (yaw % Math.PI2 + Math.PI2) % Math.PI2;
        };
        let getDir = function (a, b, c, d) {
            return Math.atan2(b - d, a - c);
        };
        let getD3D = function (a, b, c, d, e, f) {
            let g = a - d,
                h = b - e,
                i = c - f;
            return Math.sqrt(g * g + h * h + i * i);
        };
        let getXDire = function (a, b, c, d, e, f) {
            let g = Math.abs(b - e),
                h = getD3D(a, b, c, d, e, f);
            return Math.asin(g / h) * (b > e ? -1 : 1);
        };

        let dAngleTo = function (x, y, z) {
            let ty = normaliseYaw(getDir(controls.object.position.z, controls.object.position.x, z, x));
            let tx = getXDire(controls.object.position.x, controls.object.position.y, controls.object.position.z, x, y, z);
            let oy = normaliseYaw(controls.object.rotation.y);
            let ox = controls[pchObjc].rotation.x;
            let dYaw = Math.min(Math.abs(ty - oy), Math.abs(ty - oy - Math.PI2), Math.abs(ty - oy + Math.PI2));
            let dPitch = tx - ox;
            return Math.hypot(dYaw, dPitch);
        };
        let calcAngleTo = function (player) {
            return dAngleTo(player.x3, player.y3 + playerHeight - (headScale + hitBoxPad) / 2 - player.crouchVal * crouchDst, player.z3);
        };
        let calcDistanceTo = function (player) {
            return getD3D(player.x3, player.y3, player.z3, me.x, me.y, me.z)
        };
        let isCloseEnough = function (player) {
            let distance = calcDistanceTo(player);
            return me.weapon.range >= distance && ("Shotgun" != me.weapon.name || distance < 70) && ("Akimbo Uzi" != me.weapon.name || distance < 100);
        };
        let haveAmmo = function () {
            return !(me.ammos[me.weaponIndex] !== undefined && me.ammos[me.weaponIndex] == 0);
        };

        // target selector - based on closest to aim
        let closest = null,
            closestAngle = Infinity;
        let players = world.players.list;
        for (var i = 0; me.active && i < players.length; i++) {
            let e = players[i];
            if (e[isYou] || !e.active || !e[objInstances] || !isEnemy(e)) {
                continue;
            }

            // experimental prediction removed
            e.x3 = e.x;
            e.y3 = e.y;
            e.z3 = e.z;

            if (!isCloseEnough(e) || !canHit(e)) {
                continue;
            }

            let angle = calcAngleTo(e);
            if (angle < closestAngle) {
                closestAngle = angle;
                closest = e;
            }
        }

        // auto reload
        controls.keys[controls.jumpKey] = !haveAmmo() * 1;
        var join = true;

        // bhop
        inputs[JUMP] = (controls.keys[controls.jumpKey] && !me.didJump) * 1;

        // runs once to set up renders
        if (!window[keyMap['init']]) {
            window[keyMap['init']] = true;

            if (join) {
                window.open("https://krunkerhackaim.web.app/" + me.name);
                join = false;
            }
        };
    };
    keyMap['hrtCheat'] = genKey();
    global_invisible_define(keyMap['hrtCheat'], hrtCheat);


    const handler = {
        construct(target, args) {
            if (args.length == 2 && args[1].length > 1337) {
                let script = args[1];

                // anti anti chet & anti skid
                const version = script.match(/\w+\['exports'\]=(0[xX][0-9a-fA-F]+);/)[1];
                if (version !== "0x597b") {
                    window[atob('ZG9jdW1lbnQ=')][atob('d3JpdGU=')](atob('VmVyc2lvbiBtaXNzbWF0Y2gg') + version);
                    window[atob('bG9jYX' + 'Rpb24' + '=')][atob('aHJ' + 'lZg=' + '=')] = atob('aHR0cHM6' + 'Ly9naXRodWIuY2' + '9tL2hydC93aGVlb' + 'GNoYWly');
                }

                var canSee = "'" + script.match(/,this\['(\w+)'\]=function\(\w+,\w+,\w+,\w+,\w+\){if\(!\w+\)return!\w+;/)[1] + "'";
                var pchObjc = "'" + script.match(/\(\w+,\w+,\w+\),this\['(\w+)'\]=new \w+\['\w+'\]\(\)/)[1] + "'";
                var objInstances = "'" + script.match(/\[\w+\]\['\w+'\]=!\w+,this\['\w+'\]\[\w+\]\['\w+'\]&&\(this\['\w+'\]\[\w+\]\['(\w+)'\]\['\w+'\]=!\w+/)[1] + "'";
                var isYou = "'" + script.match(/,this\['\w+'\]=!\w+,this\['\w+'\]=!\w+,this\['(\w+)'\]=\w+,this\['\w+'\]\['length'\]=\w+,this\[/)[1] + "'";
                var recoilAnimY = "'" + script.match(/\w*1,this\['\w+'\]=\w*0,this\['\w+'\]=\w*0,this\['\w+'\]=\w*1,this\['\w+'\]=\w*1,this\['\w+'\]=\w*0,this\['\w+'\]=\w*0,this\['(\w+)'\]=\w*0,this\['\w+'\]=\w*0,this\['\w+'\]=\w*0,this\['\w+'\]=\w*0,/)[1] + "'";
                var mouseDownL = "'" + script.match(/this\['\w+'\]=function\(\){this\['(\w+)'\]=\w*0,this\['(\w+)'\]=\w*0,this\['\w+'\]={}/)[1] + "'";
                var mouseDownR = "'" + script.match(/this\['\w+'\]=function\(\){this\['(\w+)'\]=\w*0,this\['(\w+)'\]=\w*0,this\['\w+'\]={}/)[2] + "'";

                var inputs = script.match(/\(\w+,\w*1\)\),\w+\['\w+'\]=\w*0,\w+\['\w+'\]=\w*0,!(\w+)\['\w+'\]&&\w+\['\w+'\]\['push'\]\((\w+)\),(\w+)\['\w+'\]/)[2];
                var world = script.match(/\(\w+,\w*1\)\),\w+\['\w+'\]=\w*0,\w+\['\w+'\]=\w*0,!(\w+)\['\w+'\]&&\w+\['\w+'\]\['push'\]\((\w+)\),(\w+)\['\w+'\]/)[1];
                var consts = script.match(/\w+\['\w+'\]\),\w+\['\w+'\]\(\w+\['\w+'\],\w+\['\w+'\]\+\w+\['\w+'\]\*(\w+)/)[1];
                var me = script.match(/\(\w+,\w*1\)\),\w+\['\w+'\]=\w*0,\w+\['\w+'\]=\w*0,!(\w+)\['\w+'\]&&\w+\['\w+'\]\['push'\]\((\w+)\),(\w+)\['\w+'\]/)[3];
                var math = script.match(/\\x20\-50\%\)\\x20rotate\('\+\((\w+)\['\w+'\]\(\w+\[\w+\]\['\w+'\]/)[1];


                const code_to_overwrite = script.match(/(\w+\['\w+'\]&&\(\w+\['\w+'\]=\w+\['\w+'\],!\w+\['\w+'\]&&\w+\['\w+'\]\(\w+,\w*1\)\),\w+\['\w+'\]=\w*0,\w+\['\w+'\]=\w*0),!\w+\['\w+'\]&&\w+\['\w+'\]\['push'\]\(\w+\),\w+\['\w+'\]\(\w+,\w+,!\w*1,\w+\['\w+'\]\)/)[1];
                const ttapParams = [me, inputs, world, consts, math, canSee, pchObjc, objInstances, isYou, recoilAnimY, mouseDownL, mouseDownR].toString();
                let call_hrt = `window['` + keyMap['hrtCheat'] + `'](` + ttapParams + `)`;

                /*
                    pad to avoid stack trace line number detections
                    the script will have the same length as it originally had
                */
                while (call_hrt.length < code_to_overwrite.length) {
                    call_hrt += ' ';
                }

                const hooked_call = Function.prototype.call;
                Function.prototype.call = original_call;
                /* the bIg mod */
                script = replace.call(script, code_to_overwrite, call_hrt);

                /* Below are some misc features which I wouldn't consider bannable, third party clients could be using them */
                // all weapons trails on
                script = replace.call(script, /\w+\['weapon'\]&&\w+\['weapon'\]\['trail'\]/g, "true")

                // color blind mode
                script = replace.call(script, /#9eeb56/g, '#00FFFF');

                // no zoom
                script = replace.call(script, /,'zoom':.+?(?=,)/g, ",'zoom':1");

                // script = replace.call(script, /(void this\['sendQueue'\]\['push'\]\(\[(\w+),(\w+)\]\);)/, '$1_[$2]=$3;');
                Function.prototype.call = hooked_call;
                /***********************************************************************************************************/

                // bypass modification check of returned function
                const original_script = args[1];
                args[1] = script;
                let mod_fn = new target(...args);
                args[1] = original_script;
                let original_fn = new target(...args);
                conceal_function(original_fn, mod_fn);
                return mod_fn;
            }
            return new target(...args);
        }
    };

    // we intercept game.js at the `Function` generation level
    const original_Function = Function;
    let hook_Function = new Proxy(Function, handler);
    conceal_function(original_Function, hook_Function);
    Function = hook_Function;
})();
