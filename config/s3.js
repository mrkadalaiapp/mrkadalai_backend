import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.SUPABASE_BUCKET_NAME || 'images';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const uploadImage = async (fileBuffer, fileName, mimetype) => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials missing for image upload');
  }

  // Generate unique file name
  const fileExt = fileName.split('.').pop();
  const filePath = `${crypto.randomBytes(16).toString('hex')}.${fileExt}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, fileBuffer, {
      contentType: mimetype || 'image/jpeg',
      upsert: false
    });

  if (error) {
    console.error('Supabase Storage Upload Error:', error);
    throw error;
  }

  // Get Public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return publicUrl;
};

export const deleteImage = async (imageUrl) => {
  if (!imageUrl) return;

  try {
    // Extract file path from public URL
    // Public URL format: https://[ref].supabase.co/storage/v1/object/public/[bucket]/[path]
    const parts = imageUrl.split(`/${bucketName}/`);
    if (parts.length < 2) return;
    const filePath = parts[1];

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) throw error;
    console.log(`Successfully deleted image from Supabase: ${filePath}`);
  } catch (error) {
    console.error(`Error deleting image from Supabase: ${error.message}`);
  }
};
