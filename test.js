const weverseClient = require('./lib/weverseClient');
const logger = require('./lib/logger');

async function testApi() {
  try {
    logger.info('Testing API connection...');
    
    // Test getCommunities
    logger.info('Fetching communities...');
    const communities = await weverseClient.getCommunities();
    logger.info(`Found ${communities.length || 0} communities`);
    console.log('Communities:', JSON.stringify(communities, null, 2));
    
    // If communities are found, test getPosts for the first community
    if (communities && communities.length > 0) {
      const communityId = communities[0].id;
      logger.info(`Fetching posts for community ID: ${communityId}`);
      const posts = await weverseClient.getPosts(communityId);
      logger.info(`Found ${posts.length || 0} posts`);
      console.log('Posts:', JSON.stringify(posts, null, 2));
    }
    
  } catch (error) {
    logger.error(`API test failed: ${error.message}`);
    if (error.response) {
      logger.error(`Error response: ${JSON.stringify(error.response.data || {})}`);
    }
  }
}

// Run the test
testApi(); 