var MapManager = require("../world/MapManager.js")
var e = require('../libs/enums.js');
var NumberManager = new class {
    constructor() {
        this._usedIds = [];
        this._useddims = [];
    }
    new_id(length) {
        var result, i, j;
        result = '';
        for (j = 0; j < length; j++) {
            i = Math.floor(Math.random() * 16).toString(16).toUpperCase();
            result = result + i;
        }
        return result;
    }
    gen_id(length) {
        let self = this;
        let id = self.new_id(length);
        while (self._usedIds[id]) {
            id = self.new_id();
        }
        this._usedIds[id] = true;
        return id;
    }
    new_dim() {
        return (Math.floor(Math.random() * (10000 - 1)) + 1) * -1;
    }
    gen_dim() {
        let self = this;
        let dim = self.new_dim();
        while (self._useddims[dim]) {
            dim = self.new_dim();
        }
        this._useddims[dim] = true;
        return dim;
    }
    clear_dim(dim) {
        this._useddims[dim] = true;
    }
}
var Lobby = class {
    constructor() {
        let self = this;
        self._host = undefined;
        self._name = "";
        self._image = "";
        self._image = "";
        self._map = undefined;
        self._weapons = [];
        self._max_players = 0;
        self._players = [];
        self._players_ready = [];
        self._teamsDead = [];
        self._teams = [];
        self._dim = NumberManager.gen_dim();
        self._status = e.LOBBY_CREATING;
        self._id = NumberManager.gen_id(5);
        self._objects = [];
        self._spawnpoints = [];
        self._round = 1;
        self._MaxRounds = 1;
        self._roundDuration = 5 * 60; // 5 Minutes;
        self._orgLobbyCooldown = 5;
        self._lobbyWaitCooldown = self._orgLobbyCooldown;
        self._previewCam = {
            x: 0,
            y: 0,
            z: 0,
            px: 0,
            py: 0,
            pz: 0
        };
        self._tick = setInterval(function() {
            self.tick();
        }, 1000)
    }
    set host(player) {
        this._host = player;
    }
    get host() {
        return this._host;
    }
    get objects() {
        return this._objects;
    }
    set objects(arr_objects) {
        this._objects = arr_objects;
    }
    get weapons() {
        return this._weapons;
    }
    set weapons(arr_weapons) {
        this._weapons = arr_weapons;
    }
    get dead_players() {
        return this._teamsDead;
    }
    reset() {
        this._lobbyWaitCooldown = this._orgLobbyCooldown;
        this.status = e.LOBBY_CREATING;
        this._teamsDead = [];
        if (this._cLoaded) {
            clearInterval(this._cLoaded);
        }
        this.players.forEach(function(player) {
            LobbyManager.leaveLobby(player.client);
        })
    }
    get round() {
        return this._round;
    }
    get MaxRound() {
        return this._MaxRounds;
    }
    set MaxRounds(rs) {
        this._MaxRounds = rs;
    }
    get round_duration() {
        return this._roundDuration;
    }
    set round_duration(dur) {
        this._roundDuration = dur;
    }
    set status(s) {
        this._status = s;
    }
    get status() {
        return this._status;
    }
    get image() {
        return this._image;
    }
    get name() {
        return this._name;
    }
    set name(ename) {
        this._name = ename;
    }
    get id() {
        return this._id;
    }
    set map(mapName) {
        let map = MapManager.getMapData(mapName);
        console.log("set map", map)
        if (map) {
            this._map = map.name;
            this._image = map.image;
            this._maxPlayers = map.max_players;
            this.objects = map.objects;
            this._spawnpoints = map.spawns;
            this._teams = map.teams;
            this._previewCam = map.previewCam;
            this.weapons = map.weapons;
            console.log("set lobby to " + mapName);
        } else {
            return e.LOBBY_MAP_NOT_FOUND
        }
    }
    get map() {
        return this._map;
    }
    get players() {
        return this._players;
    }
    get player_count() {
        return this._players.length;
    }
    get max_players() {
        return this._maxPlayers;
    }
    get teams() {
        let temp_teams = this._teams.map(e => {
            let t = e;
            t.players = 0;
            return t;
        });
        this.players.forEach(function(player) {
            temp_teams[player.team].players += 1;
        });
        return temp_teams;
    }
    update_status() {
        let self = this;
        if ((self.player_count == 0) && (self.status == e.LOBBY_RUNNING)) {
            if (!self._idleTick) self._idleTick = 0;
            self._idleTick += 1;
            if (self._idleTick > 120) LobbyManager.clear(self.id);
        }
        if (self.players.length > 0) {
            if (self.status == e.LOBBY_CREATING) {
                console.log("LOBBY WAITING");
                self.status = e.LOBBY_WAITING;
            } else if (self.status == e.LOBBY_WAITING) {
                self._lobbyWaitCooldown -= 1;
                if (self._lobbyWaitCooldown < 1) {
                    console.log("LOBBY_STARTING");
                    self.status = e.LOBBY_STARTING;
                }
            }
        }
    }
    tick() {
        let self = this;
        self.update_status();
        let tPlayerNames = [];
        if (self.status == e.LOBBY_WAITING) {
            self._teams.forEach(function(e, i) {
                let temp_team = {
                    name: e.name,
                    players: []
                };
                self.players.forEach(function(e) {
                    if (e.team == i) {
                        temp_team.players.push({
                            name: e.client.name,
                            ping: e.client.ping
                        })
                    }
                });
                tPlayerNames.push(temp_team)
            });
        }
        if (self.status == e.LOBBY_RUNNING) {
            self.round_duration -= 1;
            if (self.round_duration <= 0) {
                self.end();
            }
            let dead_teams = Object.keys(this._teamsDead).map(e => {
                return this._teamsDead[e];
            })
            console.log("dead_teams",dead_teams);

            self.players.forEach(function(player) {
                player.client.call("GP:RoundInfo", [self.round_duration,JSON.stringify(dead_teams)]);
            });
        }
        if (self.players.length > 0) {
            self.players.forEach(function(player) {
                if (player.ready == 0) {
                    player.ready = 1;
                    if (player.client.interface.getState == "waitingLobby") {
                        player.client.interface.updateState("readyLobby");
                        player.client.setVariable("current_status", "cam");
                        console.log(JSON.stringify(self._previewCam));
                        player.client.call("GP:LobbyCam", [JSON.stringify(self._previewCam)]);
                    }
                } else {
                    player.client.call("GP:Ping");
                }
                if (self.status == e.LOBBY_WAITING) {
                    player.client.call("GP:LobbyUpdate", [JSON.stringify(tPlayerNames), self._lobbyWaitCooldown]);
                }
            })
            if (self.status == e.LOBBY_STARTING) {
                self.prepare();
                console.log("prepare()");
            }
            if (self.status == e.LOBBY_COUNTDOWN) {
                self.players.forEach(function(player) {
                    player.client.call("GP:ScaleForm", ["Starting..."]);
                });
                self.status = e.LOBBY_COUNTDOWN_5;
            } else if (self.status == e.LOBBY_COUNTDOWN_5) {
                self.players.forEach(function(player) {
                    player.client.call("GP:ScaleForm", ["5"]);
                });
                self.status = e.LOBBY_COUNTDOWN_4;
            } else if (self.status == e.LOBBY_COUNTDOWN_4) {
                self.players.forEach(function(player) {
                    player.client.call("GP:ScaleForm", ["4"]);
                });
                self.status = e.LOBBY_COUNTDOWN_3;
            } else if (self.status == e.LOBBY_COUNTDOWN_3) {
                self.players.forEach(function(player) {
                    player.client.call("GP:ScaleForm", ["3"]);
                });
                self.status = e.LOBBY_COUNTDOWN_2;
            } else if (self.status == e.LOBBY_COUNTDOWN_2) {
                self.players.forEach(function(player) {
                    player.client.call("GP:ScaleForm", ["2"]);
                });
                self.status = e.LOBBY_COUNTDOWN_1;
            } else if (self.status == e.LOBBY_COUNTDOWN_1) {
                self.players.forEach(function(player) {
                    player.client.call("GP:ScaleForm", ["1"]);
                });
                self.status = e.LOBBY_COUNTDOWN_GO;
            } else if (self.status == e.LOBBY_COUNTDOWN_GO) {
                self.status = e.LOBBY_RUNNING;
                self.players.forEach(function(player) {
                    player.client.call("GP:ScaleForm", ["Go!"]);
                });
                self.start();
            }
        }
    }
    loaded(player) {
        if (this._players_ready.indexOf(player) == -1) {
            this._players_ready.push(player);
        }
    }
    start() {
        let self = this;
        self.players.forEach(function(player) {
            player.client.setVariable("current_status", "ingame");
            player.client.call("GP:StartGame");
        });
    }
    prepare() {
        let self = this;
        if (self.status == e.LOBBY_STARTING) {
            self.status = e.LOBBY_PREPARING;
            console.log("status" + e.LOBBY_PREPARING);
            let spawns = JSON.parse(JSON.stringify(self._spawnpoints));
            self._teams.forEach(function(e, i) {
                console.log("team", e.name);
                let team_spawns = spawns.filter(e => {
                    return e.team == i;
                })
                let team = i;
                let clothing = e.clothing;
                console.log("clothing", clothing);
                console.log("team spawns", team_spawns);
                self.players.forEach(function(e) {
                    if (e.team == team) {
                        let spawn_pos = team_spawns.pop();
                        if (spawn_pos) {
                            console.log("spawn player at", spawn_pos, clothing, self._dim);
                            e.client.interface.spawn(spawn_pos.x, spawn_pos.y, spawn_pos.z, spawn_pos.heading, clothing);
                            e.client.interface.setEquipment(self.weapons);
                            e.client.setVariable("team", team);
                            e.client.setVariable("current_status", "cam");
                            e.client.call("GP:StartCam");
                            e.client.call("Lobby:LoadObjects", [self.id, JSON.stringify(self.objects)]);
                        } else {
                            self.reset();
                        }
                    }
                });
            });
            self._tempTries = 100;
            self._cLoaded = setInterval(function() {
                if (self._players_ready.length == self._players.length) {
                    clearInterval(self._cLoaded);
                    self.status = e.LOBBY_COUNTDOWN;
                }
                self._tempTries -= 1;
                if (self._tempTries < 1) {
                    clearInterval(self._cLoaded);
                    self.reset();
                }
            }, 5000);
        }
    }
    end() {
        this.status = e.LOBBY_ENDING;
        console.log("round enderino");
    }
    killed(victim, killer) {
        let self = this;
        let pos = victim.position;
        let model = victim.model;
        let heading = victim.heading;
        victim = this.players.find(function(player) {
            return player.client == victim;
        });
        console.log("victim", victim);
        killer = this.players.find(function(player) {
            return player.client == killer;
        });
        console.log("killer", killer);
        let victim_team = this.teams.find(function(e, i) {
            return victim.team == i;
        });
        console.log("KILLED VICTIM KILLER");
        console.log("team", victim_team);
        let clothes = JSON.stringify(victim_team.clothing);
        this.players.forEach(function(player) {
            player.client.call("GP:DummyBody", [pos.x, pos.y, pos.z, model, heading, clothes]);
        });
        if (!this._teamsDead[victim_team]) {
            this._teamsDead[victim_team] = [];
        }
        this._teamsDead[victim_team].push(victim);
        if (this._teamsDead[victim_team].length >= victim_team.players) {
            console.log(victim_team.name, "team 0 survivors");
            self.end();
        }
    }
    getPlayer(player) {
        let p = this._players.find(e => {
            return e.client == player;
        })[0];
        if (p) {
            return p;
        } else {
            return e.LOBBY_PLAYER_NOT_FOUND
        }
    }
    join(player, team) {
        if (this.teams[team]) {
            if ((this.player_count + 1) <= this.max_players) {
                console.log("team exists", team, this.teams[team])
                if ((this.teams[team].players + 1) <= this.teams[team].max) {
                    if (this.player_count == 0) {
                        this.host = player;
                    }
                    this._lobbyWaitCooldown = this._orgLobbyCooldown;
                    player.interface.lobby = this.id;
                    this._players.push({
                        client: player,
                        team: team,
                        kills: 0,
                        deaths: 0,
                        assists: 0,
                        ready: 0
                    })
                    player.setVariable("current_status", "lobby");
                    return e.LOBBY_JOIN_SUCCESS
                } else {
                    return e.LOBBY_JOIN_FAIL_TEAM_FULL;
                }
            } else {
                return e.LOBBY_JOIN_FAIL_FULL
            }
        } else {
            return e.LOBBY_JOIN_FAIL_TEAM_INVALID;
        }
    }
}
let TestLobby1 = new Lobby();
setTimeout(function() {
    TestLobby1.name = "TestLobby1";
    TestLobby1.map = "testMap";
}, 1000)
let TestLobby2 = new Lobby();
setTimeout(function() {
    TestLobby2.name = "TestLobby2";
    TestLobby2.map = "testMap";
}, 1000)
let TestLobby3 = new Lobby();
setTimeout(function() {
    TestLobby3.name = "TestLobby3";
    TestLobby3.map = "testMap";
}, 1000)
var LobbyManager = new class {
    constructor() {
        this._setup();
    }
    _setup() {
        var self = this;
        self._lobbies = [TestLobby1, TestLobby2, TestLobby3];
    }
    getLobbyByID(id) {
        return this._lobbies.find(e => {
            return e.id == id;
        })
    }
    get lobbies() {
        return this._lobbies.map(e => {
            return {
                name: e.name,
                image: e.image,
                id: e.id,
                players: e.player_count,
                max_players: e.max_players,
                map: e.map,
                status: e.status,
                teams: e.teams,
                rounds: e.rounds
            }
        })
    }
    getLobbyPlayerIsIn(player) {
        console.log("TODO getLobbyPlayerIsIn(lobby.js)")
        return;
    }
    createLobby(map) {}
    deleteLobby(id) {}
    leaveLobby(player) {}
    joinLobby(player, id, teamIndex) {
        if (player.interface) {
            console.log("joinLobby");
            let lobby = this.getLobbyByID(id);
            if (lobby) {
                console.log("Lobby exists");
                let lobbyRequest = lobby.join(player, teamIndex);
                if (lobbyRequest == e.LOBBY_JOIN_SUCCESS) {
                    console.log("join success", e.LOBBY_JOIN_SUCCESS);
                    player.interface.updateState("waitingLobby");
                    player.call("Lobby:Hide");
                } else {
                    player.call("Lobby:Error", [JSON.stringify({
                        title: "Error",
                        message: "translate:" + lobbyRequest,
                        timeout: 5000,
                        color: "red"
                    })]);
                }
            } else {
                player.call("Lobby:Error", [JSON.stringify({
                    title: "Error",
                    message: "translate:" + e.LOBBY_NOT_EXISTS,
                    timeout: 5000,
                    color: "red"
                })]);
            }
        }
    }
}
/*
{
    id: null, 
    class: '',
    title: '',
    titleColor: '',
    titleSize: '',
    titleLineHeight: '',
    message: '',
    messageColor: '',
    messageSize: '',
    messageLineHeight: '',
    backgroundColor: '',
    theme: 'light', // dark
    color: '', // blue, red, green, yellow
    icon: '',
    iconText: '',
    iconColor: '',
    iconUrl: null,
    image: '',
    imageWidth: 50,
    maxWidth: null,
    zindex: null,
    layout: 1,
    balloon: false,
    close: true,
    closeOnEscape: false,
    closeOnClick: false,
    displayMode: 0, // once, replace
    position: 'bottomRight', // bottomRight, bottomLeft, topRight, topLeft, topCenter, bottomCenter, center
    target: '',
    targetFirst: true,
    timeout: 5000,
    rtl: false,
    animateInside: true,
    drag: true,
    pauseOnHover: true,
    resetOnHover: false,
    progressBar: true,
    progressBarColor: '',
    progressBarEasing: 'linear',
    overlay: false,
    overlayClose: false,
    overlayColor: 'rgba(0, 0, 0, 0.6)',
    transitionIn: 'fadeInUp',
    transitionOut: 'fadeOut',
    transitionInMobile: 'fadeInUp',
    transitionOutMobile: 'fadeOutDown',
    buttons: {},
    inputs: {},
    onOpening: function () {},
    onOpened: function () {},
    onClosing: function () {},
    onClosed: function () {}
}

*/
mp.events.add("LobbyManager:LoadingFinished", function(player, lID) {
    if (player.interface) {
        console.log("LobbyManager:LoadingFinished");
        let lobby = LobbyManager.getLobbyByID(lID);
        if (lobby) {
            lobby.loaded(player);
        }
    }
});
mp.events.add("LobbyManager:Join", function(player, id, teamIndex) {
    if (player.interface) {
        if (player.interface.getState == "lobby") {
            console.log("join lobby");
            LobbyManager.joinLobby(player, id, teamIndex);
        }
    }
});
module.exports = LobbyManager;