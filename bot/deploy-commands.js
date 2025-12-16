"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var discord_js_1 = require("discord.js");
var discord_js_2 = require("discord.js");
var dotenv_1 = __importDefault(require("dotenv"));
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
dotenv_1.default.config();
// Mock client just enough to load commands
var client = new discord_js_2.Client({ intents: [] });
// We need to attach lavalink mock or ignore it?
// loadCommands uses 'utils/types' Command interface so it should be fine.
function register() {
    return __awaiter(this, void 0, void 0, function () {
        var token, clientId, commandsPath, getCommandFiles, commandFiles, commandsData, _i, commandFiles_1, filePath, commandModule, command, e_1, rest, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Started refreshing application (/) commands.');
                    token = process.env.DISCORD_TOKEN;
                    clientId = process.env.CLIENT_ID;
                    if (!token) {
                        throw new Error('Missing DISCORD_TOKEN in .env');
                    }
                    if (!clientId) {
                        throw new Error('Missing CLIENT_ID in .env');
                    }
                    commandsPath = path_1.default.join(__dirname, 'src/commands');
                    getCommandFiles = function (dir) {
                        var files = [];
                        var items = fs_1.default.readdirSync(dir, { withFileTypes: true });
                        for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
                            var item = items_1[_i];
                            if (item.isDirectory()) {
                                files = __spreadArray(__spreadArray([], files, true), getCommandFiles(path_1.default.join(dir, item.name)), true);
                            }
                            else if (item.name.endsWith('.ts') || item.name.endsWith('.js')) {
                                files.push(path_1.default.join(dir, item.name));
                            }
                        }
                        return files;
                    };
                    commandFiles = getCommandFiles(commandsPath);
                    commandsData = [];
                    _i = 0, commandFiles_1 = commandFiles;
                    _a.label = 1;
                case 1:
                    if (!(_i < commandFiles_1.length)) return [3 /*break*/, 6];
                    filePath = commandFiles_1[_i];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, Promise.resolve("".concat(filePath)).then(function (s) { return __importStar(require(s)); })];
                case 3:
                    commandModule = _a.sent();
                    command = commandModule.default;
                    if ('data' in command && 'execute' in command) {
                        commandsData.push(command.data.toJSON());
                        console.log("Loaded command: ".concat(command.data.name));
                    }
                    else {
                        console.warn("[WARNING] The command at ".concat(filePath, " is missing \"data\" or \"execute\"."));
                    }
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _a.sent();
                    console.error("[ERROR] loading ".concat(filePath, ":"), e_1);
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6:
                    rest = new discord_js_1.REST().setToken(token);
                    _a.label = 7;
                case 7:
                    _a.trys.push([7, 11, , 12]);
                    console.log("Registering ".concat(commandsData.length, " commands completely..."));
                    // Register Global
                    return [4 /*yield*/, rest.put(discord_js_1.Routes.applicationCommands(clientId), { body: commandsData })];
                case 8:
                    // Register Global
                    _a.sent();
                    console.log('Successfully reloaded application (/) commands globally.');
                    if (!process.env.GUILD_ID) return [3 /*break*/, 10];
                    return [4 /*yield*/, rest.put(discord_js_1.Routes.applicationGuildCommands(clientId, process.env.GUILD_ID), { body: commandsData })];
                case 9:
                    _a.sent();
                    console.log("Successfully reloaded application (/) commands for guild ".concat(process.env.GUILD_ID, "."));
                    _a.label = 10;
                case 10: return [3 /*break*/, 12];
                case 11:
                    error_1 = _a.sent();
                    console.error(error_1);
                    return [3 /*break*/, 12];
                case 12: return [2 /*return*/];
            }
        });
    });
}
register();
