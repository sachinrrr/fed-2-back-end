import Color from "./entities/Color";
import { connectDB } from "./index";

const seedColors = async () => {
  try {
    // Connect to database
    await connectDB();

    // Check if colors already exist
    const existingColors = await Color.find();
    if (existingColors.length > 0) {
      console.log("Colors already exist in database");
      return;
    }

    // Default colors to seed
    const colors = [
      { name: "Black", hexCode: "#000000" },
      { name: "White", hexCode: "#FFFFFF" },
      { name: "Red", hexCode: "#FF0000" },
      { name: "Blue", hexCode: "#0000FF" },
      { name: "Green", hexCode: "#008000" },
      { name: "Yellow", hexCode: "#FFFF00" },
      { name: "Purple", hexCode: "#800080" },
      { name: "Orange", hexCode: "#FFA500" },
      { name: "Pink", hexCode: "#FFC0CB" },
      { name: "Gray", hexCode: "#808080" },
      { name: "Brown", hexCode: "#A52A2A" },
      { name: "Navy", hexCode: "#000080" },
      { name: "Beige", hexCode: "#F5F5DC" },
      { name: "Maroon", hexCode: "#800000" },
      { name: "Teal", hexCode: "#008080" }
    ];

    // Insert colors
    const insertedColors = await Color.insertMany(colors);
    console.log(`Successfully seeded ${insertedColors.length} colors`);

    // List inserted colors
    insertedColors.forEach(color => {
      console.log(`- ${color.name} (${color.hexCode})`);
    });

  } catch (error) {
    console.error("Error seeding colors:", error);
  }
};

// Run if called directly
if (require.main === module) {
  seedColors().then(() => {
    console.log("Color seeding completed");
    process.exit(0);
  });
}

export { seedColors };
