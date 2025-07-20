import { Logger } from '../utils/logger.js';
import OpenAI from 'openai';
import fs from 'fs-extra';

export class BackgroundColorAnalyzer {
  constructor() {
    this.logger = new Logger();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.totalCost = 0;
    this.totalTokens = 0;
    this.processedCount = 0;
  }

  async process(images) {
    this.logger.info(`🎨 Starting background color analysis - Processing ${images.length} images`);
    
    const colorAnalysisResults = [];
    
    for (const item of images) {
      // Validate required fields
      if (!item.postId || !item.imagePath) {
        this.logger.error(`❌ Skipping invalid image item: missing postId or imagePath`);
        continue;
      }
      
      this.logger.info(`🎨 Analyzing background colors for: ${item.postId}`);

      // Read image file as buffer and convert to base64
      const imageBuffer = await fs.readFile(item.imagePath);
      const base64Image = imageBuffer.toString('base64');

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
                  text: `Analyze the background colors of this image. Focus on the dominant background color(s) behind the main subject.

Return JSON: {
  "primary_bg_color": "specific color name like 'white', 'light gray', 'beige', 'black'",
  "secondary_bg_color": "secondary background color or null",
  "bg_color_hex": "estimated hex color like '#FFFFFF' or null",
  "bg_type": "solid", "gradient", "textured", or "complex",
  "bg_brightness": "light", "medium", or "dark",
  "uniformity_score": 0.0-1.0,
  "suitable_for_matching": true/false
}

Focus on identifying clean, uniform backgrounds that would work well for content matching.` 
                },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
              ]
            }
          ],
          max_tokens: 120,
          temperature: 0
        });

        const text = response.choices[0].message.content.trim();
        analysis = JSON.parse(text);

        // Track usage and costs
        this.processedCount++;
        const promptTokens = response.usage.prompt_tokens;
        const completionTokens = response.usage.completion_tokens;
        const totalTokens = response.usage.total_tokens;
        
        // GPT-4o-mini pricing: $0.000150 per 1K input tokens, $0.000600 per 1K output tokens
        const cost = (promptTokens * 0.000150 / 1000) + (completionTokens * 0.000600 / 1000);
        
        this.totalTokens += totalTokens;
        this.totalCost += cost;
        
        // Create result object
        const colorResult = {
          ...item.metadata,
          post_id: item.postId,
          image_path: item.imagePath,
          background_analysis: analysis,
          created_at: new Date().toISOString()
        };
        
        colorAnalysisResults.push(colorResult);
        
        // Log interesting findings
        if (analysis.suitable_for_matching && analysis.uniformity_score > 0.8) {
          this.logger.info(`🎯 EXCELLENT BACKGROUND: ${analysis.primary_bg_color} (${(analysis.uniformity_score * 100).toFixed(0)}% uniform) - Great for matching!`);
        }
        
        if (this.processedCount % 50 === 0) {
          this.logger.info(`💰 Background analysis progress: ${this.processedCount} images processed, $${this.totalCost.toFixed(4)} spent`);
        }
        
      } catch (err) {
        this.logger.error(`OpenAI background analysis failed for ${item.postId}: ${err.message}`);
        continue;
      }
    }

    // Log final summary
    this.logger.info(`🎨 Background Color Analysis Complete:`);
    this.logger.info(`   📊 Images processed: ${this.processedCount}`);
    this.logger.info(`   💰 Total cost: $${this.totalCost.toFixed(4)}`);
    
    // Analyze uniformity distribution
    const goodBackgrounds = colorAnalysisResults.filter(r => 
      r.background_analysis.suitable_for_matching && r.background_analysis.uniformity_score > 0.7
    );
    
    this.logger.info(`   🎯 High-quality backgrounds: ${goodBackgrounds.length} (${((goodBackgrounds.length / colorAnalysisResults.length) * 100).toFixed(1)}%)`);
    
    // Show color distribution
    const colorCounts = {};
    colorAnalysisResults.forEach(r => {
      const color = r.background_analysis.primary_bg_color;
      colorCounts[color] = (colorCounts[color] || 0) + 1;
    });
    
    const topColors = Object.entries(colorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
      
    if (topColors.length > 0) {
      this.logger.info('🎨 TOP BACKGROUND COLORS:');
      topColors.forEach(([color, count]) => {
        this.logger.info(`   • ${color}: ${count} images`);
      });
    }

    return colorAnalysisResults;
  }

  getCostSummary() {
    return {
      processedCount: this.processedCount,
      totalCost: this.totalCost,
      totalTokens: this.totalTokens,
      averageCostPerImage: this.processedCount > 0 ? this.totalCost / this.processedCount : 0
    };
  }
} 