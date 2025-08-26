const fetch = require('node-fetch');

// Test function to check if images are accessible
async function testImageURL(url) {
  try {
    console.log(`Testing image URL: ${url}`);
    const response = await fetch(url);
    console.log(`Status: ${response.status}`);
    console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      console.log('✅ Image is accessible');
    } else {
      console.log('❌ Image is not accessible');
    }
  } catch (error) {
    console.error('❌ Error fetching image:', error.message);
  }
}

// Test some sample URLs based on your Cloudflare setup
const testUrls = [
  // Replace with actual URLs from your database
  'https://pub-YOUR_BUCKET_ID.r2.dev/sample-image.png', // Standard R2 format
  'https://YOUR_CUSTOM_DOMAIN.com/sample-image.png'     // Custom domain format
];

console.log('🧪 Testing Cloudflare R2 image accessibility...\n');

testUrls.forEach(testImageURL);
