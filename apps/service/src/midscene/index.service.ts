import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentOverChromeBridge } from '@midscene/web/bridge-mode';
import { PlaywrightAgent } from '@midscene/web/playwright';
import { chromium } from 'playwright';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class MidsceneService implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // await this.initMidscene();
    await this.playwrightInit();
  }
  async initMidscene() {
    const agent = new AgentOverChromeBridge();

    // 连接到桌面 Chrome 的新标签页
    // 记得先启动 Chrome 插件并点击 “Allow connection”，否则会超时
    await agent.connectCurrentTab();
    console.log('@@@aa');

    // 与普通 Midscene agent 的 API 相同
    await agent.ai('找到营销中心并进入');
    await sleep(3000);
    console.log('@@@aa111');
    await agent.aiAssert('当前页面应该是营销中心');
    await agent.destroy();
  }

  async playwrightInit() {
    const browser = await chromium.launch({
      headless: true, // 'true' means we can't see the browser window
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewportSize({
      width: 1280,
      height: 768,
    });
    await page.goto('https://s.kwaixiaodian.com/zone/home');
    await sleep(5000);
    const agent = new PlaywrightAgent(page);

    // 👀 type keywords, perform a search
    await agent.aiAct('选中我是店主的密码登录');
    await agent.aiInput('placeholder="请输入手机号', {
      value: 13661096177,
    });
    await agent.aiInput('placeholder="请输入密码', {
      value: '321321hsg',
    });
    await agent.aiTap('登录');
    // console.log('location', location);
    await sleep(1000);
    // 👀 assert by AI
    await agent.aiAssert('登陆成功，现在是店铺页面');

    await browser.close();
  }
}
