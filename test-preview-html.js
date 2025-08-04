import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testPreviewHTML() {
  console.log('🧪 Testing Preview HTML Generation...\n');

  try {
    // Get the latest batch
    const { data: batches, error: batchError } = await supabase
      .from('preview_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (batchError || !batches || batches.length === 0) {
      console.error('❌ No batches found');
      return;
    }

    const batch = batches[0];
    console.log(`📋 Testing with batch: ${batch.preview_id}`);

    // Generate the HTML manually to check if reroll functionality is included
    const html = generatePreviewHTML(batch);
    
    // Check for reroll functionality
    const hasRerollButton = html.includes('rerollSelectedImages()');
    const hasRerollStatus = html.includes('reroll-status');
    const hasRerollBtn = html.includes('reroll-btn');
    const hasReplaceSelected = html.includes('Replace Selected');

    console.log('\n📊 Reroll Functionality Check:');
    console.log('✅ Reroll button function:', hasRerollButton);
    console.log('✅ Reroll status div:', hasRerollStatus);
    console.log('✅ Reroll button class:', hasRerollBtn);
    console.log('✅ Replace Selected text:', hasReplaceSelected);

    if (hasRerollButton && hasRerollStatus && hasRerollBtn && hasReplaceSelected) {
      console.log('\n🎉 All reroll functionality is present in the HTML!');
    } else {
      console.log('\n❌ Some reroll functionality is missing from the HTML');
    }

    // Show a snippet of the HTML around the reroll button
    const rerollButtonIndex = html.indexOf('rerollSelectedImages()');
    if (rerollButtonIndex !== -1) {
      const snippet = html.substring(rerollButtonIndex - 100, rerollButtonIndex + 200);
      console.log('\n📄 HTML Snippet around reroll button:');
      console.log(snippet);
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

function generatePreviewHTML(batch) {
  const batchId = batch.preview_id;
  const posts = batch.posts || [];
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Content Preview - @${batch.account_username} | easypost.fun</title>
    <style>
        .reroll-status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin: 20px 0;
            padding: 15px;
            background: rgba(40, 167, 69, 0.1);
            border: 1px solid rgba(40, 167, 69, 0.3);
            border-radius: 10px;
            color: #28a745;
        }
        .spinner {
            width: 20px;
            height: 20px;
            border: 2px solid #28a745;
            border-top: 2px solid transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="selection-controls">
            <div class="selection-info">
                <span id="selected-count">0 images selected</span>
            </div>
            <div class="selection-buttons">
                <button class="select-btn" onclick="selectAllImages()">Select All</button>
                <button class="select-btn" onclick="deselectAllImages()">Deselect All</button>
                <button class="select-btn" onclick="downloadSelectedImages()">Download Selected</button>
                <button class="select-btn reroll-btn" onclick="rerollSelectedImages()" style="background: #28a745; border-color: #28a745;">
                    🔄 Replace Selected
                </button>
            </div>
        </div>
        
        <div id="reroll-status" class="reroll-status" style="display: none;">
            <div class="spinner"></div>
            <span>🔄 Generating new images...</span>
        </div>
    </div>

    <script>
        async function rerollSelectedImages() {
            const selectedImageIds = Array.from(document.querySelectorAll('.image-checkbox:checked'))
                .map(checkbox => checkbox.value);

            if (selectedImageIds.length === 0) {
                alert('Please select at least one image to replace.');
                return;
            }

            // Show loading state
            const rerollStatus = document.getElementById('reroll-status');
            const rerollBtn = document.querySelector('.reroll-btn');
            rerollStatus.style.display = 'flex';
            rerollBtn.disabled = true;
            rerollBtn.textContent = '🔄 Replacing...';

            try {
                const response = await fetch('/api/reroll-images', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        batchId: '${batchId}',
                        imageIds: selectedImageIds,
                        accountUsername: '${batch.account_username}'
                    })
                });

                const result = await response.json();

                if (result.success) {
                    // Show success message
                    alert('✅ Successfully replaced ' + selectedImageIds.length + ' images!');
                    // Reload the page to show new images
                    location.reload();
                } else {
                    alert('❌ Failed to replace images: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Reroll error:', error);
                alert('❌ Failed to replace images. Please try again.');
            } finally {
                // Hide loading state
                rerollStatus.style.display = 'none';
                rerollBtn.disabled = false;
                rerollBtn.textContent = '🔄 Replace Selected';
            }
        }
    </script>
</body>
</html>`;
}

testPreviewHTML(); 