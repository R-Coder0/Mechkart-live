"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendResponse = void 0;
const sendResponse = (res, status, data) => res.status(status).json(data);
exports.sendResponse = sendResponse;
