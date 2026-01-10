import { Schema, model } from "mongoose";

const adminSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: "admin",
    immutable: true
  }
}, { timestamps: true });

export default model("Admin", adminSchema);
