import OpenAI from 'openai';
import { Logger } from '../utils/logger.js';

export class ItemPreferenceAnalyzer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.logger = new Logger();
    
    // Cost tracking
    this.processedCount = 0;
    this.totalCost = 0;
    this.inputTokens = 0;
    this.outputTokens = 0;
    
    // Results tracking
    this.singleItemCount = 0;
    this.fullOutfitCount = 0;
    this.onPersonCount = 0;
  }

  async process(images) {
    this.logger.info(`🔍 Starting item preference analysis - Processing ${images.length} images`);
    const results = [];
    
    for (const item of images) {
      // Validate required fields
      if (!item.imageId || !item.imagePath) {
        this.logger.error(`❌ Skipping invalid image item: missing imageId or imagePath`);
        continue;
      }
      
      this.logger.info(`📷 Analyzing item preference: Image ${item.imageId}`);
      
      let analysis;
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { 
                  type: 'text', 
                  text: `Analyze this fashion image and classify it into ONE of these categories:

**single_item**: Focus on individual clothing items or accessories (shoes, bags, jewelry, single piece of clothing laid out or displayed)

**full_outfit**: Complete outfit combinations shown together (multiple pieces coordinated, flat lay outfits, outfit grids)

**on_person**: Person wearing the clothes (modeling shots, mirror selfies, person showing off outfit)

Respond with ONLY a JSON object:
{
  "item_preference": "single_item" | "full_outfit" | "on_person",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this classification was chosen"
}`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: item.imagePath,
                    detail: 'low'
                  }
                }
              ]
            }
          ],
          max_tokens: 150,
          temperature: 0.1
        });

        // Parse response
        const content = response.choices[0].message.content.trim();
        
        // Track usage and cost
        this.inputTokens += response.usage.prompt_tokens;
        this.outputTokens += response.usage.completion_tokens;
        this.totalCost += (response.usage.prompt_tokens * 0.000150 + response.usage.completion_tokens * 0.000600) / 1000;
        
        try {
          analysis = JSON.parse(content);
        } catch (parseError) {
          this.logger.error(`❌ Failed to parse JSON response for image ${item.imageId}: ${content}`);
          analysis = {
            item_preference: 'unknown',
            confidence: 0.0,
            reasoning: 'Failed to parse response'
          };
        }

        // Validate the response
        const validPreferences = ['single_item', 'full_outfit', 'on_person'];
        if (!validPreferences.includes(analysis.item_preference)) {
          this.logger.error(`❌ Invalid item preference "${analysis.item_preference}" for image ${item.imageId}`);
          analysis.item_preference = 'unknown';
        }

        // Track results
        if (analysis.item_preference === 'single_item') this.singleItemCount++;
        else if (analysis.item_preference === 'full_outfit') this.fullOutfitCount++;
        else if (analysis.item_preference === 'on_person') this.onPersonCount++;

        this.processedCount++;
        
        this.logger.info(`✅ Item preference: ${analysis.item_preference} (${(analysis.confidence * 100).toFixed(1)}% confidence)`);
        
        // Store result
        results.push({
          imageId: item.imageId,
          postId: item.postId,
          imagePath: item.imagePath,
          item_preference: analysis.item_preference,
          preference_confidence: analysis.confidence,
          preference_reasoning: analysis.reasoning
        });

      } catch (error) {
        this.logger.error(`❌ Error analyzing image ${item.imageId}: ${error.message}`);
        
        // Store error result
        results.push({
          imageId: item.imageId,
          postId: item.postId,
          imagePath: item.imagePath,
          item_preference: 'error',
          preference_confidence: 0.0,
          preference_reasoning: `Error: ${error.message}`
        });
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Log final summary
    this.logger.info(`🎉 Item Preference Analysis Complete:`);
    this.logger.info(`   📊 Images processed: ${this.processedCount}`);
    this.logger.info(`   👕 Single items: ${this.singleItemCount} (${((this.singleItemCount / this.processedCount) * 100).toFixed(1)}%)`);
    this.logger.info(`   👗 Full outfits: ${this.fullOutfitCount} (${((this.fullOutfitCount / this.processedCount) * 100).toFixed(1)}%)`);
    this.logger.info(`   👤 On person: ${this.onPersonCount} (${((this.onPersonCount / this.processedCount) * 100).toFixed(1)}%)`);
    this.logger.info(`   💰 Total cost: $${this.totalCost.toFixed(4)}`);
    this.logger.info(`   🔢 Tokens: ${this.inputTokens} input, ${this.outputTokens} output`);
    
    return results;
  }
} 