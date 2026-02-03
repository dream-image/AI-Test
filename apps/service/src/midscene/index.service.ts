import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentOverChromeBridge } from "@midscene/web/bridge-mode";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class MidsceneService implements OnModuleInit {


    constructor(private configService: ConfigService) { }

    async onModuleInit() {
        await this.initMidscene();
    }
    async initMidscene() {
        const agent = new AgentOverChromeBridge();

        // 连接到桌面 Chrome 的新标签页
        // 记得先启动 Chrome 插件并点击 “Allow connection”，否则会超时
        await agent.connectNewTabWithUrl("https://midscenejs.com/zh/bridge-mode.html");
        console.log('@@@aa');
        
        // 与普通 Midscene agent 的 API 相同
        await agent.ai('type "AI 101" and hit Enter');
        await sleep(3000);
        console.log('@@@aa111');
        await agent.aiAssert("there are some search results");
        await agent.destroy();
    }

}
