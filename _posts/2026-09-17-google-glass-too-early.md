---
layout: post
permalink: /blog/google-glass-too-early/
note: NOTE 002
category: MAKOTO LAB
location: Taipei
title_zh: Google Glass，生不逢時
title_en: Google Glass, Born Too Early
description_zh: 從穿戴式設備的今天重新看 Google Glass：2012 的未來、2019 的 EE2、2023 的退場，以及我在 2025 買下 EE2 後做出 Makoto Glass 的理由。
description_en: Reconsidering Google Glass through today's wearables — from the 2012 vision and EE2 to the device I bought in 2025 and the Makoto Glass software I built for it.
---

<div class="lang-zh" markdown="1">

> **Google Glass 不是失敗得太早，而是出生得太早。**

如果把時間倒回十幾年前，Google Glass 看起來像是一個過度樂觀的未來。

一副眼鏡，右眼前方懸著一塊小型透明顯示器；抬頭就能看到通知、導航、拍照、錄影，用語音控制，再透過手機和網路取得資訊。

2012 年 Google 公開 Project Glass 時，這些功能看起來幾乎像科幻電影裡的道具。Google I/O 的展示甚至安排跳傘、BMX 與垂降，把第一人稱畫面直接從 Glass 傳回會場。那是一場非常 Google 的發表：先把未來做出來，再問世界準備好了沒有。

今天再看，卻很難說它的方向真的錯了。

我們已經習慣讓 Apple Watch 顯示訊息與導航，習慣戴著 AirPods 接電話、叫語音助理，也逐漸接受 Meta Ray-Ban、AI Glasses 這類「眼鏡上有相機、有麥克風、能理解周遭環境」的產品。2025 年 Google 自己也再次公開 Android XR 智慧眼鏡原型：相機、麥克風、喇叭、與手機協同，以及可選的鏡片內顯示器，再把 Gemini 放進這個介面裡。

於是問題反而變成了：

**Google Glass 當年是真的失敗了，還是它只是比市場早了十年？**

<figure class="article-figure article-figure-wide">
  <img src="/assets/blog/wearable-ideas.svg" alt="Google Glass 的概念後來分散到智慧手錶、耳機、AI 眼鏡與 Android XR" loading="lazy">
  <figcaption>Glass 當年的核心想法沒有消失，只是被拆散到不同穿戴式裝置上。圖：MAKOTO LAB。</figcaption>
</figure>

## 一副在 2012 年出現的「未來眼鏡」

Google 在 2012 年公開 Project Glass，隔年開始讓開發者與早期使用者接觸 Explorer Edition。

它真正特別的地方，不只是把 Android 塞進眼鏡裡，而是它對「電腦」這件事情的想像。

Glass 並不是要讓使用者一直盯著螢幕。

它的核心其實更接近今天所說的 **glanceable computing**：資訊只在需要的時候短暫出現。天氣、訊息、導航、拍照、視訊、搜尋，都被壓縮成幾秒鐘就能完成的互動。Google 後來在 Enterprise Edition 的說明裡，也把這類互動描述成 glanceable assistance——快速瞄一眼、取得需要的資訊，再把注意力放回眼前的世界。

這個概念到今天仍然沒有過時。

問題是，當年的其他條件幾乎都還沒有跟上。

電池容量有限、處理器發熱與功耗明顯、行動網路與雲端服務遠不如今天成熟；語音辨識雖然已經能用，但距離今天的大型語言模型與 AI Assistant 還有非常大的差距。

更重要的是，社會根本還沒有準備好接受「別人臉上有一顆一直朝著你的相機」。

Glass 最後甚至催生出「Glasshole」這個帶有嘲諷意味的詞。這不是單純的硬體問題，而是技術、設計與社會規範同時落後於產品概念。

<figure class="article-figure">
  <img src="https://upload.wikimedia.org/wikipedia/commons/8/8e/Google_Glass_Explorer_Edition.jpg" alt="Google Glass Explorer Edition" loading="lazy">
  <figcaption>Google Glass Explorer Edition。攝影：Ted Eytan，Wikimedia Commons，CC BY-SA 2.0。<a href="https://commons.wikimedia.org/wiki/File:Google_Glass_Explorer_Edition.jpg" target="_blank" rel="noreferrer">來源 ↗</a></figcaption>
</figure>

2015 年 1 月，Explorer Program 結束，原版 Glass 的消費市場銷售也停止。

如果故事停在這裡，它確實很像典型的 Google 墓園產品。

但 Glass 並沒有真正消失。

## Google Glass 沒有消失，只是躲進了工廠

Google 後來把 Glass 的方向從消費市場轉向企業。

這個轉變其實很合理。

一個普通人可能不需要整天把工作郵件投影在眼前，但一個正在維修機械的技師，可能非常需要在雙手都被占用時看到操作步驟；倉儲揀貨、醫療、製造、遠端協作，也都比「一般消費者全天戴著」更容易說明 Glass 的價值。

Google 後來把 Glass 定義為一種 **assisted reality wearable**，核心是讓工作人員能夠在雙手不中斷工作的情況下查看清單、指示與資訊，也能拍下第一人稱照片與影片。

2019 年，Google 推出了 **Glass Enterprise Edition 2，EE2**。

它和最早的 Explorer Edition 已經是完全不同世代的硬體。

EE2 採用 Qualcomm Snapdragon XR1 平台，搭載 3GB LPDDR4、32GB eMMC，執行 Android 8.1 AOSP；有 Wi-Fi、Bluetooth 5.0、8MP 相機、觸控板、IMU、USB-C，以及 640 × 360 的透明顯示器。

這點很重要。

因為它代表 EE2 並不是一件只能執行企業專用程式的封閉古董。它本質上依然是一台很特殊的 Android 電腦，而且可以透過熟悉的 Android 開發方式安裝 APK。

<figure class="article-figure article-figure-wide">
  <img src="/assets/blog/google-glass-timeline.svg" alt="Google Glass 從 2012 Project Glass 到 2025 Android XR 的時間線" loading="lazy">
  <figcaption>Project Glass、Enterprise Edition 2、官方退場，再到 Android XR。圖：MAKOTO LAB。</figcaption>
</figure>

## 2023，Google 再一次結束 Glass

2023 年 3 月 15 日，Google 正式停止販售 Glass Enterprise Edition，並在同年 9 月 15 日停止官方支援。

至此，從 2012 年公開概念算起，Google Glass 走過了超過十年。

但這種產品最有趣的地方，往往也是從原廠不再支援的時間點開始。

因為設備並沒有突然壞掉。

它只是失去了原廠替它定義用途的能力。

當原廠不再告訴你「這台設備應該拿來做什麼」，它反而重新變成一塊可以被重新定義的硬體。

## 2025，我買了一台 Glass EE2

我是在 2025 年買下現在這台 Google Glass Enterprise Edition 2。

一開始其實沒有什麼宏大的理由。

我只是一直對這種「失敗的未來產品」很有興趣，尤其是 Glass。

因為它不像很多十年前的科技產品那樣，一拿到手就明顯只剩年代感。EE2 戴在頭上時仍然非常輕，右眼前方的資訊不需要低頭，不會完全擋住視線；右側觸控板的滑動與點擊邏輯，即使放到現在也依然直覺。

真正讓我感受到年代的，不是硬體，而是軟體。

Glass 本身還能運作。它可以開機、連 Wi-Fi、連 Bluetooth、裝 APK、拍照、跑 Android App。

但它原本依賴的生態系已經逐漸消失。

尤其對我來說，最大的問題是 **iPhone 整合**。

對一個今天的穿戴式裝置來說，如果它無法自然地接收手機通知，也無法控制手機正在播放的音樂，那它就很難真正成為每天會戴著的東西。

我覺得最基本的事情其實只有兩個：

1. 手機來通知時，我不用掏手機。
2. 音樂正在播放時，我可以直接看到與控制它。

這也是我開始做 **Makoto Glass** 的原因。

## 我真正想補上的，其實不是 Launcher

Makoto Glass 最開始看起來可能像是一個 Google Glass 的自製 Launcher。

但對我來說，它真正重要的部分一直不是 Launcher。

而是 **ANCS 和 AMS**。

**ANCS（Apple Notification Center Service）** 是 Apple 提供給 Bluetooth Low Energy 配件使用的通知服務。

換句話說，我希望 Glass 可以直接從 iPhone 接收通知：訊息、App 通知、來電，以及對應的通知操作。

**AMS（Apple Media Service）** 則能讓外部 Bluetooth 裝置取得目前播放的歌曲資訊，並執行播放、暫停、上一首、下一首等控制。

這兩個協定本來就是設計給穿戴裝置與 Bluetooth 配件使用的，而這正好也是 Glass 本來應該扮演的角色。

於是我開始把它們整合進 EE2。

<figure class="article-figure article-figure-wide">
  <img src="/assets/blog/makoto-glass-bridge.svg" alt="Makoto Glass 透過 ANCS 與 AMS 直接連接 iPhone 的架構" loading="lazy">
  <figcaption>Makoto Glass 的核心不是把手機畫面搬到眼鏡，而是讓 EE2 重新成為一個現代 iPhone wearable。圖：MAKOTO LAB。</figcaption>
</figure>

現在的 Makoto Glass 可以直接和 iPhone 透過 Bluetooth 連線，在 Glass 上顯示 iPhone 通知、通知紀錄、來電，以及 Now Playing 和媒體控制。

這些核心功能不需要 root，也不需要 jailbreak。

甚至在 ANCS 與 AMS 這一層，並不需要我另外開發的 iPhone App。Glass 可以直接和 iPhone 使用 Apple 原生的 Bluetooth 服務。

後來我才逐步把其他東西補上去：Launcher、Camera、照片、Tilt Wake、自動亮度、System Status、Bluetooth reconnect，以及我正在開發中的 iPhone companion app —— **Makoto Link**。

Makoto Link 未來會負責 GPS / Location Bridge、Remote、Find Glass，以及更多需要 iPhone 主動傳送資料的功能。

但這些其實都是後面的事情。

最初真正讓我想做這個專案的問題只有一個：

> **如果 Glass 今天還活著，它至少應該能自然地和手機一起工作。**

## Makoto Glass 現在真的長什麼樣子

下面不是 mockup，而是我目前在 **Google Glass Enterprise Edition 2 / Android 8.1** 上實際跑 Makoto Glass 的畫面。

<figure class="article-figure app-ui-figure">
  <div class="app-ui-grid">
    <img src="/assets/blog/glass-ui-1.png" alt="Makoto Glass Home：時間與電量" width="640" height="360" loading="lazy">
    <img src="/assets/blog/glass-ui-2.png" alt="Makoto Glass Now Playing：歌曲資訊與播放控制" width="640" height="360" loading="lazy">
    <img src="/assets/blog/glass-ui-3.png" alt="Makoto Glass ANCS 通知紀錄" width="640" height="360" loading="lazy">
    <img src="/assets/blog/glass-ui-4.png" alt="Makoto Link：iPhone 連線狀態" width="640" height="360" loading="lazy">
    <img src="/assets/blog/glass-ui-5.png" alt="Makoto Glass About：Version 1.0" width="640" height="360" loading="lazy">
    <img src="/assets/blog/glass-ui-6.png" alt="Makoto Glass System Status：電池、iPhone、Wi-Fi 與儲存空間" width="640" height="360" loading="lazy">
  </div>
  <figcaption>Makoto Glass 實機畫面：Home、AMS Now Playing、ANCS 通知紀錄、Makoto Link 連線狀態、About 與 System Status。© MAKOTO LAB。</figcaption>
</figure>

目前 Public Beta 的核心功能包括：

- 自製 Glass Launcher
- Apple Notification Center Service（ANCS）
- iPhone 通知顯示與通知紀錄
- 支援的通知操作與來電處理
- Apple Media Service（AMS）
- Now Playing 與媒體控制
- Camera / Photo Viewer
- Application Launcher
- Tilt Wake
- 自動亮度
- System Status
- Bluetooth reconnect 與 recovery

目前 EE2 是唯一完整測試過的 Glass 型號；更早期的 Enterprise Edition 1 與 Explorer Edition 是否相容，仍需要更多測試。

[Makoto Glass — Public Beta / GitHub ↗](https://github.com/lancer1234/MakotoGlass-Beta)

## 回頭看，Google Glass 到底錯在哪裡？

現在再看 Glass，我很難說 Google 當年的技術方向是錯的。

相反地，它提出的很多概念後來都成為主流。

手腕上的通知變成了智慧手錶。

耳邊的語音助理進入了無線耳機。

第一人稱相機重新出現在智慧眼鏡。

AI 開始成為穿戴裝置最重要的介面之一。

甚至「不要一直拿手機出來，而是讓電腦在需要時出現在視野或耳邊」這個核心想法，也正在重新成為科技公司追逐的方向。

Google Glass 真正的問題，也許不是它不知道未來在哪裡。

而是它在 2012 年就到了那個未來。

當時的電池還不夠好，SoC 還不夠省電，AI 還不夠聰明，使用者還沒習慣隨身攝影機，整個社會也還沒有建立起智慧穿戴設備應該遵守的禮儀。

所以市場最後拒絕的，也許不是「智慧眼鏡」本身。

而是 **2012 年版本的智慧眼鏡**。

這也是我現在還會對 EE2 感興趣的原因。

它不是一台功能最強的 wearable。

甚至從很多規格來看，它已經非常老了。

但戴上它之後，仍然會讓人感覺到一件很奇妙的事情：

**這個產品的未來感，並沒有真的消失。**

只是整個世界花了比 Google 預期更久的時間，才慢慢追上它。

---

### 資料來源

- [Google — Project Glass demo: Hangouts IN Air (2012)](https://blog.google/alphabet/project-glass-demo-hangouts-in-air/)
- [Google — Glass Enterprise Edition 2: faster and more helpful (2019)](https://blog.google/products-and-platforms/devices/glass-enterprise-edition-2/)
- [Google Support — Glass Enterprise Edition 2 specifications](https://support.google.com/glass-enterprise/customer/answer/9220200?hl=en)
- [Google Support — End of Glass Enterprise Edition sales and support](https://support.google.com/glass-enterprise/customer/answer/10012550?hl=en)
- [Google — Android XR glasses at I/O 2025](https://blog.google/products-and-platforms/platforms/android/android-xr-gemini-glasses-headsets/)
- [TechCrunch — Explorer Edition sales ended January 19, 2015](https://techcrunch.com/2015/01/19/today-is-the-last-day-to-buy-google-glass/)

</div>

<div class="lang-en" markdown="1">

> **Google Glass did not fail too early. It was born too early.**

If you rewind to 2012, Google Glass looks almost excessively optimistic: a transparent display at the edge of your vision, navigation, notifications, first-person photos and video, voice control, and information pulled from a phone and the cloud.

At the time it looked like science fiction. Today, many of those ideas have simply been redistributed across Apple Watch, wireless earbuds, camera glasses, AI wearables and the new wave of Android XR devices.

That makes the more interesting question not “Why did Glass fail?” but **how many years ahead of its environment it really was.**

<figure class="article-figure article-figure-wide">
  <img src="/assets/blog/wearable-ideas.svg" alt="Google Glass ideas distributed across smartwatches, earbuds, AI glasses and Android XR" loading="lazy">
  <figcaption>The core interaction ideas survived; they were distributed across an ecosystem. Graphic: MAKOTO LAB.</figcaption>
</figure>

## A future computer that appeared in 2012

The important thing about Glass was never simply that Google put Android on a pair of glasses. It proposed a different relationship with computing: information appears briefly when needed, then gets out of the way.

That idea — glanceable computing — still feels current. But almost everything around it was immature in 2012: batteries, thermal efficiency, mobile connectivity, voice interfaces, cloud services and social expectations around a camera worn on someone's face.

<figure class="article-figure">
  <img src="https://upload.wikimedia.org/wikipedia/commons/8/8e/Google_Glass_Explorer_Edition.jpg" alt="Google Glass Explorer Edition" loading="lazy">
  <figcaption>Google Glass Explorer Edition. Photo: Ted Eytan, Wikimedia Commons, CC BY-SA 2.0. <a href="https://commons.wikimedia.org/wiki/File:Google_Glass_Explorer_Edition.jpg" target="_blank" rel="noreferrer">Source ↗</a></figcaption>
</figure>

Consumer sales ended in 2015, but Glass did not immediately disappear. Google moved it into enterprise work, where hands-free information made more immediate sense.

## It disappeared into factories instead

For technicians, warehouse workers, clinicians and field teams, a small display that can show instructions without occupying the hands has an obvious purpose. Google repositioned Glass as an assisted-reality wearable and in 2019 introduced **Glass Enterprise Edition 2**.

EE2 uses Qualcomm's XR1 platform, 3GB of LPDDR4 memory, 32GB of storage and Android 8.1 AOSP. It includes Wi-Fi, Bluetooth 5.0, an 8MP camera, touchpad, motion sensors, USB-C and a 640 × 360 transparent display.

Under the unusual form factor, it is still an Android computer that can run APKs.

<figure class="article-figure article-figure-wide">
  <img src="/assets/blog/google-glass-timeline.svg" alt="Google Glass timeline from Project Glass to Android XR" loading="lazy">
  <figcaption>From Project Glass to EE2, official retirement, and Google's return to smart glasses with Android XR. Graphic: MAKOTO LAB.</figcaption>
</figure>

## 2023: the ecosystem left before the hardware did

Google stopped selling Glass Enterprise Edition on March 15, 2023 and ended official support on September 15.

The hardware did not suddenly stop working. What disappeared was the ecosystem that told users what the device was supposed to be.

That is exactly the point where discontinued hardware becomes interesting to me: once the manufacturer stops defining the future of a device, the hardware becomes open to reinterpretation.

## In 2025, I bought an EE2

I bought the Glass Enterprise Edition 2 I use today in 2025.

There was no grand plan. I have always been interested in failed futures, and Glass is unusual because the hardware does not feel purely nostalgic. EE2 is still light, the display sits outside the center of vision, and the touchpad interaction remains surprisingly natural.

What felt old was the software ecosystem — especially phone integration.

For a modern wearable, two things matter immediately: I should be able to see a notification without taking out my phone, and I should be able to see and control what is currently playing.

That became the starting point for **Makoto Glass**.

## What I wanted to restore was not just the launcher

From the outside, Makoto Glass can look like a custom Google Glass launcher. The part that matters most to me, however, is **ANCS** and **AMS**.

Apple Notification Center Service lets supported Bluetooth Low Energy accessories receive notification information from an iPhone. Apple Media Service exposes Now Playing metadata and media controls.

Those services are intended for accessories and wearables — exactly the role I wanted Glass to play again.

<figure class="article-figure article-figure-wide">
  <img src="/assets/blog/makoto-glass-bridge.svg" alt="Makoto Glass connecting directly to iPhone through ANCS and AMS" loading="lazy">
  <figcaption>The goal is not to mirror a phone screen, but to make EE2 behave like a modern iPhone wearable again. Graphic: MAKOTO LAB.</figcaption>
</figure>

The current Makoto Glass build can receive supported iPhone notifications, retain notification history, handle supported notification actions and incoming calls, show Now Playing information and control media playback.

The core ANCS and AMS features do not require root, jailbreak or a custom iPhone app. Glass talks directly to Apple's native Bluetooth services.

I later added the launcher, camera and photo viewer, Tilt Wake, automatic brightness, system status, Bluetooth reconnect/recovery, and began working on **Makoto Link**, an iPhone companion for GPS / Location Bridge, Remote, Find Glass and other features that require the phone to actively send data.

> **If Glass were still alive today, it should at least be able to work naturally with the phone in my pocket.**

## What Makoto Glass actually looks like

These are real captures from the current build running on **Google Glass Enterprise Edition 2 / Android 8.1**, not mockups.

<figure class="article-figure app-ui-figure">
  <div class="app-ui-grid">
    <img src="/assets/blog/glass-ui-1.png" alt="Makoto Glass Home showing the time and battery level" width="640" height="360" loading="lazy">
    <img src="/assets/blog/glass-ui-2.png" alt="Makoto Glass Now Playing with track information and media controls" width="640" height="360" loading="lazy">
    <img src="/assets/blog/glass-ui-3.png" alt="Makoto Glass ANCS notification history" width="640" height="360" loading="lazy">
    <img src="/assets/blog/glass-ui-4.png" alt="Makoto Link iPhone connection status" width="640" height="360" loading="lazy">
    <img src="/assets/blog/glass-ui-5.png" alt="Makoto Glass About screen showing Version 1.0" width="640" height="360" loading="lazy">
    <img src="/assets/blog/glass-ui-6.png" alt="Makoto Glass System Status showing battery, iPhone, Wi-Fi and storage" width="640" height="360" loading="lazy">
  </div>
  <figcaption>Current Makoto Glass UI: Home, AMS Now Playing, ANCS notification history, Makoto Link status, About and System Status. © MAKOTO LAB.</figcaption>
</figure>

The current Public Beta includes a custom Glass launcher, ANCS notification integration, AMS media controls, camera and photo viewing, application launching, Tilt Wake, automatic brightness, system status, and Bluetooth recovery.

[Makoto Glass — Public Beta / GitHub ↗](https://github.com/lancer1234/MakotoGlass-Beta)

## So was Google simply too early?

Looking back, it is difficult for me to say that Google's direction was wrong.

The ideas Glass introduced — glanceable information, first-person capture, voice interaction, a heads-up display and phone companionship — did not disappear. They matured elsewhere.

Notifications moved to watches. Voice moved into earbuds. First-person cameras returned in smart glasses. AI became one of the most important interfaces for wearable computing. Even the broader idea of not constantly pulling out a phone is now being pursued again by major technology companies.

Google's mistake may not have been failing to understand the future.

It may have been arriving there in 2012.

The battery technology was not ready. The processors were not efficient enough. AI was not capable enough. Society had not established etiquette around wearable cameras, and users had not yet learned what role a wearable computer should play beside a smartphone.

So perhaps the market did not reject smart glasses.

It rejected **the 2012 version of smart glasses**.

That is why I still find EE2 interesting. It is old by specification, but putting it on still produces a strange feeling: the future it was designed for never completely disappeared.

The rest of the world simply took longer than Google expected to catch up.

---

### Sources

- [Google — Project Glass demo: Hangouts IN Air (2012)](https://blog.google/alphabet/project-glass-demo-hangouts-in-air/)
- [Google — Glass Enterprise Edition 2: faster and more helpful (2019)](https://blog.google/products-and-platforms/devices/glass-enterprise-edition-2/)
- [Google Support — Glass Enterprise Edition 2 specifications](https://support.google.com/glass-enterprise/customer/answer/9220200?hl=en)
- [Google Support — End of Glass Enterprise Edition sales and support](https://support.google.com/glass-enterprise/customer/answer/10012550?hl=en)
- [Google — Android XR glasses at I/O 2025](https://blog.google/products-and-platforms/platforms/android/android-xr-gemini-glasses-headsets/)
- [TechCrunch — Explorer Edition sales ended January 19, 2015](https://techcrunch.com/2015/01/19/today-is-the-last-day-to-buy-google-glass/)

</div>
