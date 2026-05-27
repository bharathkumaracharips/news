"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
async function testFetch(url) {
    console.log('\n----------------------------------------');
    console.log('Testing direct crawl for:', url);
    try {
        const res = await axios_1.default.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.google.com/',
            }
        });
        console.log('Status code:', res.status);
        console.log('HTML length:', res.data.length);
        const $ = cheerio.load(res.data);
        const paragraphs = [];
        $('p').each((_, el) => {
            paragraphs.push($(el).text().trim());
        });
        console.log('Found paragraphs:', paragraphs.length);
        console.log('Sample paragraphs:', paragraphs.filter(p => p.length > 20).slice(0, 5));
    }
    catch (err) {
        console.error('Error fetching URL:', err.message);
        if (err.response) {
            console.log('Response Status:', err.response.status);
            console.log('Response Headers:', err.response.headers);
            console.log('Response Data Snippet:', err.response.data.substring(0, 1000));
        }
    }
}
async function run() {
    // Test Moneycontrol
    await testFetch('https://www.moneycontrol.com/news/india/cabinet-approves-sarthak-pds-scheme-to-modernise-ration-system-support-grain-transport-1273380.html');
    // Test Business Standard
    await testFetch('https://www.business-standard.com/industry/banking/sebi-seeks-feedback-on-new-options-strike-price-mechanism-124052700562_1.html');
}
run();
