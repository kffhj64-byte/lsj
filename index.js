const { Telegraf, Markup } = require('telegraf');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const fs = require('fs');
const express = require('express');

puppeteer.use(StealthPlugin());

// --- الإعدادات الأساسية ---
const BOT_TOKEN = process.env.BOT_TOKEN || '8690835074:AAGcbDTPCqP5ixRVf9LC73EX4NGNnf_6_S4';
const MY_TELEGRAM_ID = parseInt(process.env.MY_TELEGRAM_ID) || 8435344041; 

const bot = new Telegraf(BOT_TOKEN);
const userState = {};

// --- خادم الويب لاستضافة Render ---
const app = express();
app.get('/', (req, res) => res.send('🟢 لوحة تحكم VIP تعمل بنجاح! السيرفر نشط.'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 الخادم الوهمي يعمل على المنفذ ${PORT}`));

// --- الواجهات الجذابة ---
const mainMenu = Markup.keyboard([
    ['🚀 إرسال طلب دعم جديد', '📊 حالة السيرفر'],
    ['❌ إلغاء العملية']
]).resize();

const countryMenu = Markup.inlineKeyboard([
    [Markup.button.callback('🇾🇪 اليمن (+967)', 'set_code_+967'), Markup.button.callback('🇸🇦 السعودية (+966)', 'set_code_+966')],
    [Markup.button.callback('🇪🇬 مصر (+20)', 'set_code_+20'), Markup.button.callback('🌐 رمز آخر (يدوي)', 'set_code_manual')],
    [Markup.button.callback('🚫 إلغاء', 'cancel_task')]
]);

// --- وظائف مساعدة ---
const randomDelay = (min = 40, max = 90) => Math.floor(Math.random() * (max - min + 1) + min);
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

let globalBrowser;

// --- الإدارة الذكية للمتصفح ---
async function getBrowser() {
    if (globalBrowser && globalBrowser.connected) {
        return globalBrowser;
    }
    console.log("🔄 جاري تهيئة محرك المتصفح...");
    try {
        globalBrowser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-extensions'
            ]
        });
        console.log("✅ المتصفح الاحترافي جاهز للعمل.");
        return globalBrowser;
    } catch (e) {
        console.error("❌ خطأ في تشغيل المتصفح:", e);
        throw e;
    }
}

// حماية البوت (السماح للمدير فقط)
bot.use(async (ctx, next) => {
    if (ctx.from && ctx.from.id === MY_TELEGRAM_ID) {
        try {
            await next();
        } catch (err) {
            console.error("❌ حدث خطأ في معالجة الطلب:", err);
        }
    }
});

bot.start(async (ctx) => {
    delete userState[ctx.from.id];
    await ctx.replyWithHTML(
        `<b>مرحباً بك سيدي في لوحة التحكم VIP 👑</b>\n\n` +
        `<i>النظام جاهز ومؤمن بالكامل للعمل على Render.</i>`, 
        mainMenu
    );
});

bot.hears('📊 حالة السيرفر', async (ctx) => {
    const isConnected = globalBrowser && globalBrowser.connected;
    const status = isConnected ? "🟢 متصل (Render Online)" : "🔴 المحرك في وضع الاستعداد";
    await ctx.replyWithHTML(`<b>📊 حالة النظام:</b>\nالمتصفح: ${status}\nالخادم: 🟢 متصل`);
});

bot.hears('❌ إلغاء العملية', async (ctx) => {
    delete userState[ctx.from.id];
    await ctx.reply('✅ تم تنظيف الجلسة والعودة للقائمة الرئيسية.', mainMenu);
});

bot.hears('🚀 إرسال طلب دعم جديد', async (ctx) => {
    userState[ctx.from.id] = { step: 'select_country' };
    await ctx.replyWithHTML('<b>🌍 الخطوة 1:</b> اختر الدولة المستهدفة:', countryMenu);
});

bot.action(/set_code_(.+)/, async (ctx) => {
    const code = ctx.match[1];
    const state = userState[ctx.from.id];
    
    if (!state) return ctx.answerCbQuery('⚠️ الجلسة منتهية، ابدأ من جديد.', { show_alert: true });

    if (code === 'manual') {
        state.step = 'get_manual_code';
        await ctx.editMessageText('📝 أرسل رمز الدولة فقط (مثال: +967):');
    } else {
        state.countryCode = code;
        state.step = 'get_phone';
        await ctx.editMessageText(`✅ تم اختيار الرمز (${code})\n\n<b>الآن أرسل رقم الهاتف المحلي فقط (بدون رمز الدولة):</b>`, { parse_mode: 'HTML' });
    }
    await ctx.answerCbQuery();
});

bot.on('text', async (ctx) => {
    const state = userState[ctx.from.id];
    if (!state) return;

    const text = ctx.message.text.trim();

    // تجاهل أزرار الكيبورد الرئيسية
    if (['🚀 إرسال طلب دعم جديد', '📊 حالة السيرفر', '❌ إلغاء العملية'].includes(text)) return;

    if (state.step === 'get_manual_code') {
        state.countryCode = text.startsWith('+') ? text : '+' + text;
        state.step = 'get_phone';
        await ctx.replyWithHTML(`✅ تم استلام الرمز (${state.countryCode})\n\n<b>الآن أرسل رقم الهاتف المحلي فقط:</b>`);
    }
    else if (state.step === 'get_phone') {
        // تنظيف الرقم من أي إشارات زائدة والاحتفاظ بالرقم المحلي فقط
        state.localPhone = text.replace('+', '').trim();
        state.fullPhone = state.countryCode + state.localPhone;
        state.step = 'get_email';
        await ctx.replyWithHTML('<b>📧 الخطوة 2:</b> أرسل البريد الإلكتروني:');
    } 
    else if (state.step === 'get_email') {
        if (!isValidEmail(text)) return ctx.reply('⚠️ إيميل غير صحيح، حاول مجدداً:');
        state.email = text;
        state.step = 'get_message';
        await ctx.replyWithHTML('<b>📝 الخطوة 3:</b> أرسل نص الرسالة لواتساب:');
    }
    else if (state.step === 'get_message') {
        state.customMessage = text;
        state.step = 'confirm';
        
        const summary = `<b>👑 مراجعة الطلب النهائي (VIP)</b>\n\n` +
                        `🌍 <b>رمز الدولة:</b> <code>${state.countryCode}</code>\n` +
                        `📱 <b>الرقم المحلي:</b> <code>${state.localPhone}</code>\n` +
                        `📧 <b>الإيميل:</b> <code>${state.email}</code>\n\n` +
                        `<b>هل تريد التنفيذ الآن؟</b>`;
        
        await ctx.replyWithHTML(summary, Markup.inlineKeyboard([
            [Markup.button.callback('🚀 نعم، أرسل الآن', 'start_task')],
            [Markup.button.callback('❌ إلغاء', 'cancel_task')]
        ]));
    }
});

bot.action('cancel_task', async (ctx) => {
    delete userState[ctx.from.id];
    await ctx.editMessageText('❌ تم إلغاء العملية بنجاح.');
    await ctx.answerCbQuery();
});

bot.action('start_task', async (ctx) => {
    const state = userState[ctx.from.id];
    if (!state) return ctx.answerCbQuery('⚠️ الجلسة منتهية، ابدأ من جديد.', { show_alert: true });
    
    await ctx.editMessageText('🔄 <b>جاري تشغيل محرك VIP وإرسال الطلب... الرجاء الانتظار قليلاً⏳</b>', { parse_mode: 'HTML' });
    
    // تمرير البيانات المفصلة للمحرك
    runSupportTask(state.countryCode, state.localPhone, state.email, state.customMessage, ctx);
    delete userState[ctx.from.id];
    await ctx.answerCbQuery();
});

async function runSupportTask(countryCode, localPhone, email, customMsg, ctx) {
    let browser, context, page;
    const fullPhone = countryCode + localPhone;

    try {
        browser = await getBrowser();
        context = await browser.createIncognitoBrowserContext();
        page = await context.newPage();
        
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        const desktopUA = new UserAgent({ deviceCategory: 'desktop' }).toString();
        await page.setUserAgent(desktopUA);
        
        await page.goto('https://www.whatsapp.com/contact/noclient/', { waitUntil: 'networkidle2', timeout: 60000 });
        
        await page.waitForSelector('input[name="phone_number"]', { timeout: 30000 });
        
        // --- 1. التعامل الذكي مع حقل اختيار الدولة ---
        await page.evaluate((cCode) => {
            const cleanCode = cCode.replace('+', '');
            const selects = Array.from(document.querySelectorAll('select'));
            const countrySelect = selects.find(s => s.name.includes('country') || s.className.includes('country'));
            
            if (countrySelect) {
                for (let option of countrySelect.options) {
                    if (option.value.includes(cleanCode) || option.text.includes(cCode)) {
                        countrySelect.value = option.value;
                        countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
                        break;
                    }
                }
            } else {
                const inputs = Array.from(document.querySelectorAll('input'));
                const countryInput = inputs.find(i => i.name.includes('country') || i.name === 'phone_number_country_code');
                if (countryInput) {
                    countryInput.value = cleanCode;
                    countryInput.dispatchEvent(new Event('input', { bubbles: true }));
                    countryInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }, countryCode);

        // --- 2. إدخال الرقم المحلي فقط ---
        await page.evaluate(() => {
            const phoneInput = document.querySelector('input[name="phone_number"]');
            if (phoneInput) phoneInput.value = ''; // تصفير الحقل لضمان عدم الدمج الخاطئ
        });
        await page.type('input[name="phone_number"]', localPhone, { delay: randomDelay() });
        
        // --- 3. إدخال الإيميل (مع المرونة في المسميات) ---
        await page.type('input[name="email"], input[type="email"]', email, { delay: randomDelay() });
        
        const confirmEmailExists = await page.$('input[name="email_confirm"]');
        if (confirmEmailExists) {
            await page.type('input[name="email_confirm"]', email, { delay: randomDelay() });
        }

        // --- 4. تحديد نظام Android ---
        await page.evaluate(() => {
            const androidRadio = document.querySelector('input[type="radio"][value="android"]') || 
                                 document.querySelector('input[type="radio"]');
            if (androidRadio) androidRadio.click();
        });
        
        // --- 5. كتابة الرسالة ---
        await page.type('#message, textarea[name="message"], textarea', customMsg, { delay: randomDelay(20, 50) });
        
        // --- 6. الإرسال ---
        await page.waitForSelector('button[type="submit"]', { timeout: 15000 });
        await page.click('button[type="submit"]');
        
        await new Promise(r => setTimeout(r, 5000));
        
        // تأكيد الإرسال النهائي إن تطلب الأمر
        const finalSubmit = await page.$('button[type="submit"]');
        if (finalSubmit) {
            await page.click('button[type="submit"]');
            await new Promise(r => setTimeout(r, 3000));
        }

        await ctx.replyWithHTML(`✅ <b>تم الإرسال بنجاح سيدي!</b>\n\n📱 الرقم المستهدف: <code>${fullPhone}</code>`);
    } catch (err) {
        console.error("Task Error:", err);
        if (page) {
            const screenshotPath = `error_${Date.now()}.png`;
            try {
                await page.screenshot({ path: screenshotPath });
                await ctx.replyWithPhoto({ source: screenshotPath }, { caption: `❌ فشل الإرسال.\nالخطأ: ${err.message}` });
                if (fs.existsSync(screenshotPath)) fs.unlinkSync(screenshotPath);
            } catch (screenshotErr) {
                await ctx.reply(`❌ فشل الإرسال ولم أتمكن من التقاط صورة.\nالخطأ: ${err.message}`);
            }
        } else {
            await ctx.reply(`❌ فشل الاتصال بالمحرك: ${err.message}`);
        }
    } finally {
        if (page) await page.close().catch(e => console.log(e));
        if (context) await context.close().catch(e => console.log(e));
    }
}

// تشغيل البوت وتهيئة المتصفح
getBrowser().then(() => {
    bot.launch({ dropPendingUpdates: true });
    console.log("🤖 بوت التليجرام يعمل الآن.");
}).catch(err => console.error("❌ فشل تشغيل النظام:", err));

// --- الإغلاق الآمن للموارد ---
process.once('SIGINT', async () => {
    if (globalBrowser) await globalBrowser.close();
    bot.stop('SIGINT');
});
process.once('SIGTERM', async () => {
    if (globalBrowser) await globalBrowser.close();
    bot.stop('SIGTERM');
});
