import { Request,Response } from "express"
import Thumbnail from "../models/Thumbnail.js";
import CLIPDROP_API_KEY from "../configs/clipdrop.js";
import path from "node:path";
import fs from 'fs'
import {v2 as cloudinary} from 'cloudinary'

const stylePrompts = {
    'Bold & Graphic': 'eye-catching thumbnail, bold typography, vibrant colors, expressive facial reaction, dramatic lighting, high contrast, click-worthy composition, professional style',
    'Tech/Futuristic': 'futuristic thumbnail, sleek modern design, digital UI elements, glowing accents, holographic effects, cyber-tech aesthetic, sharp lighting, high-tech atmosphere',
    'Minimalist': 'minimalist thumbnail, clean layout, simple shapes, limited color palette, plenty of negative space, modern flat design, clear focal point',
    'Photorealistic': 'photorealistic thumbnail,ultra-realistic lighting, natural skin tones, candid moment, DSLR-style photography, lifestyle realism, shallow depth of field',
    'Illustrated': 'illustrated thumbnail, custom digital illustration, stylized characters, bold outlines, vibrant colors, creative cartoon or vector art style',
}

const colorSchemeDescriptions = {
    vibrant: 'vibrant and energetic colors, high saturation, bold contrasts, eye-catching palette',
    sunset: 'warm sunset tones, orange pink and purple hues, soft gradients, cinematic glow',
    forest: 'natural green tones, earthy colors, calm and organic palette, fresh atmosphere',
    neon: 'neon glow effects, electric blues and pinks, cyberpunk lighting, high contrast glow',
    purple: 'purple-dominant color palette, magenta and violet tones, modern and stylish mood',
    monochrome: 'black and white color scheme, high contrast, dramatic lighting, timeless aesthetic',
    ocean: 'cool blue and teal tones, aquatic color palette, fresh and clean atmosphere',
    pastel: 'soft pastel colors, low saturation, gentle tones, calm and friendly aesthetic',
}

export const generateThumbnail = async (req: Request, res: Response)=>{
    try {
        const {userId} = req.session;
        const {title, prompt: user_prompt, style, aspect_ratio, color_scheme, text_overlay} = req.body;

        const thumbnail = await Thumbnail.create({
            userId,
            title,
            prompt_used: user_prompt,
            user_prompt,
            style,
            aspect_ratio,
            color_scheme,
            text_overlay,
            isGenerating: true
        })

        // Build the prompt
        let prompt = `Create a ${stylePrompts[style as keyof typeof stylePrompts]} for: "${title}"`

        if (color_scheme) {
            prompt += ` Use a ${colorSchemeDescriptions[color_scheme as keyof typeof colorSchemeDescriptions]} color scheme.`
        }

        if (user_prompt) {
            prompt += ` Additional details: ${user_prompt}.`
        }

        prompt += ` The thumbnail should be ${aspect_ratio}, visually stunning, and designed to maximize click-through rate. Make it bold, professional, and impossible to ignore.`

        // Build multipart/form-data for Clipdrop API
        const form = new FormData();
        form.append('prompt', prompt);

        // Call the Clipdrop text-to-image API
        const clipdropResponse = await fetch('https://clipdrop-api.co/text-to-image/v1', {
            method: 'POST',
            headers: {
                'x-api-key': CLIPDROP_API_KEY,
            },
            body: form,
        });

        if (!clipdropResponse.ok) {
            const errBody = await clipdropResponse.json() as { error: string };
            throw new Error(errBody.error || `Clipdrop error: ${clipdropResponse.status}`);
        }

        // Response is raw PNG bytes
        const arrayBuffer = await clipdropResponse.arrayBuffer();
        const finalBuffer = Buffer.from(arrayBuffer);

        const filename = `final-output-${Date.now()}.png`;
        const filePath = path.join('images', filename);

        // Create the image directory if it doesn't exist
        fs.mkdirSync('images', {recursive: true})

        // Write the final image to disk
        fs.writeFileSync(filePath, finalBuffer);

        const uploadResult = await cloudinary.uploader.upload(filePath, {resource_type: 'image'})

        thumbnail.image_url = uploadResult.url;
        thumbnail.isGenerating = false;
        await thumbnail.save()

        res.json({message: 'Thumbnail Generated', thumbnail})

        // Remove image file from disk
        fs.unlinkSync(filePath)

    } catch (error: any) {
        console.log(error);
        res.status(500).json({message: error.message})
    }
}

// Controller for Thumbnail Deletion
export const deleteThumbnail = async (req: Request, res: Response)=>{
    try {
        const {id} = req.params;
        const {userId} = req.session;

        await Thumbnail.findByIdAndDelete({_id: id, userId})

        res.json({message: 'Thumbnail deleted successfully'});

    } catch (error: any) {
        console.log(error)
        res.status(500).json({message: error.message})
    }
}