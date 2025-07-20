// Batch API Cost Comparison for Fashion Pipeline
// This script shows the incredible savings from using OpenAI's Batch API

const totalImages = 7988;

// Current optimized individual API costs
const optimizedPromptTokens = 10; // Our compressed prompt
const estimatedResponseTokens = 40; // Compressed JSON response
const totalTokensPerImage = optimizedPromptTokens + estimatedResponseTokens;

// Individual API pricing (GPT-4o-mini)
const individualInputCost = 0.000150 / 1000; // per token
const individualOutputCost = 0.000600 / 1000; // per token

// Batch API pricing (50% discount)
const batchInputCost = 0.000075 / 1000; // per token
const batchOutputCost = 0.000300 / 1000; // per token

console.log('🚀 FASHION PIPELINE BATCH API COST ANALYSIS');
console.log('=' .repeat(50));

console.log(`📊 Dataset: ${totalImages.toLocaleString()} images`);
console.log(`📝 Optimized prompt: ${optimizedPromptTokens} tokens`);
console.log(`📤 Estimated response: ${estimatedResponseTokens} tokens`);
console.log(`🔢 Total tokens per image: ${totalTokensPerImage} tokens`);

console.log('\n💰 COST COMPARISON:');
console.log('-'.repeat(30));

// Individual API costs (our current optimized version)
const individualCostPerImage = (optimizedPromptTokens * individualInputCost) + (estimatedResponseTokens * individualOutputCost);
const totalIndividualCost = individualCostPerImage * totalImages;

console.log(`Individual API (current):  $${individualCostPerImage.toFixed(6)} per image`);
console.log(`Individual API total:      $${totalIndividualCost.toFixed(4)}`);

// Batch API costs
const batchCostPerImage = (optimizedPromptTokens * batchInputCost) + (estimatedResponseTokens * batchOutputCost);
const totalBatchCost = batchCostPerImage * totalImages;

console.log(`Batch API:                 $${batchCostPerImage.toFixed(6)} per image`);
console.log(`Batch API total:           $${totalBatchCost.toFixed(4)}`);

// Savings calculation
const totalSavings = totalIndividualCost - totalBatchCost;
const percentSavings = (totalSavings / totalIndividualCost) * 100;

console.log('\n🎉 BATCH API SAVINGS:');
console.log('-'.repeat(30));
console.log(`Total savings:             $${totalSavings.toFixed(4)}`);
console.log(`Percentage savings:        ${percentSavings.toFixed(1)}%`);
console.log(`Cost reduction per image:  $${(individualCostPerImage - batchCostPerImage).toFixed(6)}`);

console.log('\n📈 ADDITIONAL BENEFITS:');
console.log('-'.repeat(30));
console.log('✅ Higher rate limits for batch processing');
console.log('✅ No need to handle rate limiting/throttling');
console.log('✅ Better for large-scale processing');
console.log('✅ Asynchronous processing (results within 24h)');
console.log('✅ Built-in retry handling');

console.log('\n⏱️  PROCESSING TIME:');
console.log('-'.repeat(30));
console.log('Individual API: Rate limited, sequential processing');
console.log('Batch API: Parallel processing, results within 24h');

console.log('\n🔄 COMBINED OPTIMIZATIONS:');
console.log('-'.repeat(30));

// Original unoptimized cost (before our prompt optimization)
const originalPromptTokens = 25; // Original verbose prompt
const originalResponseTokens = 70; // Uncompressed JSON
const originalCostPerImage = (originalPromptTokens * individualInputCost) + (originalResponseTokens * individualOutputCost);
const originalTotalCost = originalCostPerImage * totalImages;

console.log(`Original pipeline:         $${originalTotalCost.toFixed(4)}`);
console.log(`Optimized + Batch:         $${totalBatchCost.toFixed(4)}`);

const totalOptimization = originalTotalCost - totalBatchCost;
const totalOptimizationPercent = (totalOptimization / originalTotalCost) * 100;

console.log(`TOTAL OPTIMIZATION:        $${totalOptimization.toFixed(4)} saved (${totalOptimizationPercent.toFixed(1)}%)`);

console.log('\n🎯 OPTIMIZATION BREAKDOWN:');
console.log('-'.repeat(30));
console.log(`Prompt optimization:       ${((originalTotalCost - totalIndividualCost) / originalTotalCost * 100).toFixed(1)}% savings`);
console.log(`Batch API:                 ${percentSavings.toFixed(1)}% additional savings`);
console.log(`Combined effect:           ${totalOptimizationPercent.toFixed(1)}% total reduction`);

console.log('\n💡 RECOMMENDATION:');
console.log('-'.repeat(30));
console.log('Use Batch API for all future pipeline runs!');
console.log(`You\'ll save $${totalSavings.toFixed(4)} every time you process your ${totalImages.toLocaleString()} images.`); 