#!/usr/bin/env python3
"""批量生成医疗器械产品宣传片提示词并保存为 CSV。"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path


PRODUCTS = [
    ("便携式心电记录仪", "居家健康管理", "轻薄机身、快速佩戴、清晰波形展示", "中老年用户与家庭照护者"),
    ("数字式血压计", "家庭日常监测", "大屏读数、单键测量、历史记录", "关注血压管理的家庭用户"),
    ("医用制氧机", "家庭氧疗场景", "稳定供氧、低噪运行、便捷调节", "遵医嘱进行氧疗的用户"),
    ("雾化器", "家庭呼吸护理", "细腻雾化、低噪设计、易于清洁", "儿童、成人及其照护者"),
    ("红外额温计", "家庭与机构快速测温", "非接触测量、快速显示、夜间可读", "家庭、学校与基层机构"),
    ("指夹式脉搏血氧仪", "运动后及日常健康观察", "轻巧便携、双色显示、操作直观", "家庭用户与运动爱好者"),
    ("电动轮椅", "室内外辅助出行", "灵活操控、舒适坐姿、安全制动", "行动不便人士及照护者"),
    ("助听器", "日常沟通与社交", "小巧佩戴、声音调节、生活场景适配", "存在听力需求的成年人"),
    ("睡眠呼吸机", "居家睡眠呼吸支持", "平稳送气、安静运行、数据查看", "经专业评估需使用设备的人群"),
    ("超声多普勒胎心仪", "孕期家庭辅助监测", "人体工学探头、声音清晰、便携收纳", "遵循专业指导的孕期家庭"),
    ("医用冷敷贴", "运动与日常冷敷护理", "柔软贴合、独立包装、使用便捷", "有局部冷敷护理需求的用户"),
    ("家用低频治疗仪", "居家物理治疗辅助", "多档调节、贴片操作、定时设计", "经专业建议使用的成年人"),
]


def build_prompt(index: int, product: tuple[str, str, str, str]) -> dict[str, str]:
    name, scene, features, audience = product
    prompt = (
        f"制作一支30秒的{name}产品宣传片，面向{audience}。"
        f"开场用干净明亮的生活化镜头呈现{scene}，随后以产品特写、实际操作和信息图形依次展示"
        f"{features}。整体采用专业医疗科技风，蓝白配色，柔和自然光，镜头稳定，画面真实克制；"
        f"加入简洁中文字幕与舒缓旁白，避免夸大疗效、治愈承诺和使用前后对比。"
        f"结尾展示产品名称、规范使用提醒，并明确提示：本产品不能替代医生诊断或治疗，"
        f"适用范围、禁忌及操作方法请以说明书和专业人员指导为准。16:9，4K，商业广告质感。"
    )
    return {
        "序号": str(index),
        "产品名称": name,
        "目标场景": scene,
        "目标人群": audience,
        "宣传片提示词": prompt,
    }


def generate_csv(output_path: Path) -> None:
    rows = [build_prompt(index, product) for index, product in enumerate(PRODUCTS, start=1)]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="生成 12 条医疗器械宣传片提示词 CSV")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("medical_device_prompts.csv"),
        help="输出 CSV 路径（默认：medical_device_prompts.csv）",
    )
    args = parser.parse_args()
    generate_csv(args.output)
    print(f"已生成 {len(PRODUCTS)} 条提示词：{args.output.resolve()}")


if __name__ == "__main__":
    main()
