// scope-worker.js

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSL representation
 */
function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max == min) {
        h = s = 0; // achromatic
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, l];
}

function calculateHistogram(imageData) {
    const data = imageData.data;
    const bins = 256;
    const histograms = {
        r: new Uint32Array(bins).fill(0),
        g: new Uint32Array(bins).fill(0),
        b: new Uint32Array(bins).fill(0),
    };

    for (let i = 0; i < data.length; i += 4) {
        histograms.r[data[i]]++;
        histograms.g[data[i + 1]]++;
        histograms.b[data[i + 2]]++;
    }
    return histograms;
}

function calculateRGBParade(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const levels = 256;
    
    const paradeData = {
        r: new Uint32Array(width * levels).fill(0),
        g: new Uint32Array(width * levels).fill(0),
        b: new Uint32Array(width * levels).fill(0),
    };

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < imageData.height; y++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            paradeData.r[(levels - 1 - r) * width + x]++;
            paradeData.g[(levels - 1 - g) * width + x]++;
            paradeData.b[(levels - 1 - b) * width + x]++;
        }
    }
    return { width, height: levels, ...paradeData };
}


function calculateVectorscope(imageData) {
    const data = imageData.data;
    const size = 256; // The resolution of our data grid
    const vectorscopeData = new Uint32Array(size * size).fill(0);

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // YUV conversion constants for Rec. 709
        const u = (b - (0.2126 * r + 0.7152 * g + 0.0722 * b)) * 0.5389;
        const v = (r - (0.2126 * r + 0.7152 * g + 0.0722 * b)) * 0.6350;

        // Map UV coordinates to our grid.
        // The center of the grid is (size/2, size/2).
        // We scale the UV values to fit within the grid.
        const x = Math.round((v / 128) * (size / 2) + size / 2);
        const y = Math.round((-u / 128) * (size / 2) + size / 2);
        
        if (x >= 0 && x < size && y >= 0 && y < size) {
            vectorscopeData[y * size + x]++;
        }
    }
     return { size, data: vectorscopeData };
}


self.onmessage = function(e) {
    const { imageData, scopeType } = e.data;

    try {
        let result;
        if (scopeType === 'histogram') {
            result = calculateHistogram(imageData);
        } else if (scopeType === 'waveform') {
            result = calculateRGBParade(imageData);
        } else if (scopeType === 'vectorscope') {
            result = calculateVectorscope(imageData);
        }

        if (result) {
            self.postMessage({ scopeType, result });
        } else {
            self.postMessage({ error: `Invalid scope type: ${scopeType}` });
        }
    } catch (error) {
        self.postMessage({ error: error.message, stack: error.stack });
    }
};
