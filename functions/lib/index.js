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
Object.defineProperty(exports, "__esModule", { value: true });
exports.onConferenceBookingUpdate = exports.onFolioUpdate = exports.onRoomBookingUpdate = exports.notifyOnCreate = void 0;
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
// Export existing triggers
var notifications_1 = require("./triggers/notifications"); // Moving the original logic here for cleanliness
Object.defineProperty(exports, "notifyOnCreate", { enumerable: true, get: function () { return notifications_1.notifyOnCreate; } });
// Export new email triggers
var roomBookings_1 = require("./triggers/roomBookings");
Object.defineProperty(exports, "onRoomBookingUpdate", { enumerable: true, get: function () { return roomBookings_1.onRoomBookingUpdate; } });
var payments_1 = require("./triggers/payments");
Object.defineProperty(exports, "onFolioUpdate", { enumerable: true, get: function () { return payments_1.onFolioUpdate; } });
var conferenceBookings_1 = require("./triggers/conferenceBookings");
Object.defineProperty(exports, "onConferenceBookingUpdate", { enumerable: true, get: function () { return conferenceBookings_1.onConferenceBookingUpdate; } });
