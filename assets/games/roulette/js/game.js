var phaser;
//noinspection JSUnusedGlobalSymbols
var game = {
    init: function (id, width, height) {
        phaser = new Phaser.Game(width, height, Phaser.AUTO, id, {
            preload: preload,
            create: create,
            update: update,
            render: render
        })
    }
};

function preload() {
    phaser.load.image('bg', '/assets/games/roulette/images/bg.png');
    phaser.load.image('chip', '/assets/games/roulette/images/chip.png');
    phaser.load.image('ball', '/assets/games/roulette/images/ball.png');
    phaser.load.image('coin', '/assets/games/roulette/images/coin.png');
    phaser.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
    phaser.scale.setScreenSize();
}

var bg;
var ball;
// 37 == 00
// starts at 180 degrees and goes clockwise
var pockets = [
    0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 37, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2
];
var chips = [];
var wheel = {
    x: 162,
    y: 227
};
var wallet = {
    x: 400,
    y: 500
};
var red = {
    x: 462,
    y: 301,
    r: 544,
    b: 329,
    w: 544 - 462,
    h: 329 - 301
};
var black = {
    x: 552,
    y: 297,
    r: 628,
    b: 326,
    w: 628 - 552,
    h: 326 - 297
};
var numbers = {
    x: 375,
    y: 153,
    r: 715,
    b: 258,
    w: 715 - 375,
    h: 258 - 153
};

function setPocket(number) {
    console.log("pocket number " + number);
    $.each(pockets, function (i, v) {
        if (v === number) {
            console.log("i " + i);
            var a = (1 / 4 - (1 - i / pockets.length)) * 2 * Math.PI;
            var r = 75;
            var x = wheel.x + r * Math.cos(a);
            var y = wheel.y + r * Math.sin(a);
            phaser.add.tween(ball).to({
                x: x,
                y: y
            }, 500).start();
        }
    })
}

function create() {

    bg = phaser.add.sprite(400, 225, 'bg');

    bg.anchor.set(0.5);

    var x = (800 - phaser.width) / 2;
    var y = (450 - phaser.height) / 2;

    phaser.world.setBounds(x, y, 0, 0);

    bg.inputEnabled = true;
    bg.events.onInputDown.add(listener, this);

    ball = phaser.add.sprite(wheel.x, wheel.y, 'ball');
    ball.anchor.set(0.5);

    core.addButton("Spin!", spin);

    core.get(
        "/api/games/roulette",
        function (data) {
            setPocket(data.pocket);
            $.each(data.bets, function (i, bet) {
                switch (bet.type) {
                    case "number":
                        console.log("bet.pocket " + bet.pocket);
                        var x = numbers.x + ((bet.pocket - 1) / 3 + 0.5) * (numbers.w / 12);
                        var y = numbers.y + (2 - (bet.pocket - 1) % 3 + 0.5) * (numbers.h / 3);

                        chips.push(addChip(x, y));
                        break;
                    case "red":
                        chips.push(addChip(red.x + red.w / 2, red.y + red.h / 2));
                        break;
                    case "black":
                        chips.push(addChip(black.x + black.w / 2, black.y + black.h / 2));
                        break;
                }
            });
            ready();
        });
}

function ready() {
    if (chips.length > 0) {
        core.enableButton("Spin!");
    } else {
        core.disableButton("Spin!");
    }
}

function matcher(x1, y1, x2, y2) {
    return function (x, y) {
        return x > x1 && x < x2 && y > y1 && y < y2
    }
}

function listener() {
    var pointer = {x: phaser.input.x - phaser.world.x, y: phaser.input.y - phaser.world.y};
    $.each(
        [
            [matcher(red.x, red.y, red.r, red.b), placeRedBet],
            [matcher(black.x, black.y, black.r, black.b), placeBlackBet],
            [matcher(numbers.x, numbers.y, numbers.r, numbers.b), placeNumberBet]
        ],
        function (i, v) {
            var m = v[0](pointer.x, pointer.y);
            if (m) {
                var fn = v[1];
                // console.log("fn "+fn);
                fn(pointer);
            }
        }
    );
}

function addChip(x, y) {
    var chip = phaser.add.image(wallet.x, wallet.y, "chip");
    chip.anchor.set(0.5);
    phaser.add.tween(chip).to({
        x: x,
        y: y
    }, 250).start();
    return chip;
}

function placeBet(type, location, options) {
    options = options || {};
    var chip = addChip(location.x, location.y);
    core.post(
        "/api/games/roulette/bets/" + type,
        {"amount": core.coin, "number": options.number},
        function (data) {
            chips.push(chip);
            core.setBalance(data.balance)
        },
        function () {
            chip.kill();
        }
    );
}

function placeBlackBet(pointer) {
    placeBet("black", pointer)
}

function placeRedBet(pointer) {
    placeBet("red", pointer)
}

function placeNumberBet(pointer) {
    var x = parseInt(12 * (pointer.x - numbers.x) / numbers.w);
    var y = 3 - parseInt(3 * (pointer.y - numbers.y) / numbers.h);
    var number = x * 3 + y;

    console.log("x " + x + ", y " + y + ", number " + number);

    placeBet("number", pointer, {
        number: number
    })
}

function spin() {
    core.post(
        "/api/games/roulette/spins",
        {},
        function (data) {
            $.each(chips, function (i, v) {

                var emitter = phaser.add.emitter(0, 0, 100);

                emitter.makeParticles('coin');
                emitter.gravity = 1000;

                emitter.x = v.x;
                emitter.y = v.y;
                v.kill();
                emitter.start(true, 1000, null, 5);
            });
            chips = [];
            core.setBalance(data.balance);
            setPocket(data.pocket);
        }
    );
}

function update() {

}

function render() {
    // phaser.debug.cameraInfo(phaser.camera, 32, 32);
}

var s = document.createElement("script");
s.setAttribute("src", "/assets/games/roulette/js/phaser.min.js");
document.getElementsByTagName("head")[0].appendChild(s);