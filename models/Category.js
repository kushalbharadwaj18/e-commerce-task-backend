const mongoose = require("mongoose")

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
	path: String,
    description: String,
    image: String,
  },
  { timestamps: true },
)

module.exports = mongoose.model("Category", categorySchema)
