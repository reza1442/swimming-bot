const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
const OpenAI = require('openai');
const https = require('https');
require('dotenv').config();

// ========== تنظیمات اتصال ==========
const agent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: false
});

// ========== مقداردهی اولیه ==========
const bot = new TelegramBot(process.env.BOT_TOKEN, { 
  polling: true,
  request: {
    agent: agent,
    url: process.env.API_URL
  }
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ========== پیام خوش‌آمدگویی ==========
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `سلام 👋 به ربات جستجوی مقالات شنا و غریق‌نجات خوش اومدی!\n\n`
    + `دستورات:\n`
    + `/search [موضوع] - جستجوی مقاله\n`
    + `مثال: /search غریق‌نجات در استخر`
  );
});

// ========== جستجوی مقالات ==========
bot.onText(/\/search (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1];
  
  bot.sendMessage(chatId, '🔍 در حال جستجوی مقالات...');

  try {
    const articles = await searchScholar(query);
    
    if (articles.length === 0) {
      return bot.sendMessage(chatId, '❌ مقاله‌ای پیدا نشد.');
    }

    bot.sendMessage(chatId, '🧠 در حال خلاصه‌سازی مقالات...');
    const summary = await summarizeArticles(articles, query);

    let message = `📚 **نتایج جستجو برای:** "${query}"\n\n`;
    message += summary + '\n\n';
    message += '📎 **منابع:**\n';
    
    articles.forEach((article, index) => {
      message += `${index + 1}. [${article.title}](${article.link})\n`;
    });

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, '❌ خطایی رخ داد. لطفاً دوباره تلاش کن.');
  }
});

// ========== تابع جستجو در Google Scholar ==========
async function searchScholar(query) {
  const searchQuery = encodeURIComponent(`${query} swimming lifeguard`);
  const url = `https://scholar.google.com/scholar?q=${searchQuery}&hl=en`;
  
  const { data } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  const $ = cheerio.load(data);
  const articles = [];

  $('.gs_ri').each((i, el) => {
    if (i < 5) {
      const titleEl = $(el).find('.gs_rt a');
      const title = titleEl.text().trim();
      const link = titleEl.attr('href');
      const snippet = $(el).find('.gs_rs').text().trim();
      const authors = $(el).find('.gs_a').text().trim();

      if (title && link) {
        articles.push({ title, link, snippet, authors });
      }
    }
  });

  return articles;
}

// ========== تابع خلاصه‌سازی با OpenAI ==========
async function summarizeArticles(articles, query) {
  const articlesText = articles.map((a, i) => 
    `مقاله ${i + 1}: ${a.title}\nنویسندگان: ${a.authors}\nخلاصه: ${a.snippet}`
  ).join('\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'تو یک دستیار پژوهشی هستی. مقالات علمی رو به فارسی خلاصه می‌کنی.'
      },
      {
        role: 'user',
        content: `موضوع جستجو: "${query}"\n\nمقالات پیدا شده:\n${articlesText}\n\nلطفاً این مقالات رو به صورت خلاصه و مفید به فارسی توضیح بده و نکات کلیدی هر کدوم رو بگو.`
      }
    ],
    max_tokens: 1000,
    temperature: 0.7
  });

  return response.choices[0].message.content;
}

// ========== راهنمای دستورات ==========
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `دستورات موجود:\n`
    + `/start - شروع ربات\n`
    + `/search [موضوع] - جستجوی مقاله درباره شنا و غریق‌نجات\n`
    + `/help - راهنما\n\n`
    + `مثال: /search تکنیک‌های نجات غریق`
  );
});

console.log('✅ ربات با موفقیت راه‌اندازی شد!');
