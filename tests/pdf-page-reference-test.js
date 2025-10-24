// PDF Page Reference Test
// This test ensures that PDF summaries include page references

const fs = require('fs');
const path = require('path');

// Mock PDF content for testing
const mockPDFContent = {
  fullText: `Introduction

This document presents a comprehensive analysis of artificial intelligence applications in modern software development. The research methodology encompasses both theoretical frameworks and practical implementations.

Background Theory

Artificial intelligence has evolved significantly over the past decade. Machine learning algorithms now power numerous applications across various industries. Deep learning techniques have shown remarkable success in image recognition and natural language processing.

Methodology

Our approach combines quantitative analysis with qualitative observations. We conducted surveys with 200 software developers and analyzed 50 real-world AI implementations. The data collection process followed established research protocols.

Results

The findings indicate that 85% of developers have integrated AI tools into their workflow. Performance improvements averaged 40% across all measured metrics. Cost reduction was observed in 78% of the surveyed projects.

Discussion

These results suggest that AI adoption in software development is accelerating. However, challenges remain in terms of training and implementation costs. Further research is needed to address these limitations.

Conclusion

In conclusion, AI technologies offer significant benefits to software development teams. Organizations should invest in AI training programs to maximize these benefits. Future work should focus on developing more accessible AI tools.`,
  pageSegments: [
    {
      page: 1,
      text: `Introduction

This document presents a comprehensive analysis of artificial intelligence applications in modern software development. The research methodology encompasses both theoretical frameworks and practical implementations.`,
      startChar: 0,
      endChar: 200
    },
    {
      page: 2,
      text: `Background Theory

Artificial intelligence has evolved significantly over the past decade. Machine learning algorithms now power numerous applications across various industries. Deep learning techniques have shown remarkable success in image recognition and natural language processing.`,
      startChar: 200,
      endChar: 450
    },
    {
      page: 3,
      text: `Methodology

Our approach combines quantitative analysis with qualitative observations. We conducted surveys with 200 software developers and analyzed 50 real-world AI implementations. The data collection process followed established research protocols.`,
      startChar: 450,
      endChar: 650
    },
    {
      page: 4,
      text: `Results

The findings indicate that 85% of developers have integrated AI tools into their workflow. Performance improvements averaged 40% across all measured metrics. Cost reduction was observed in 78% of the surveyed projects.`,
      startChar: 650,
      endChar: 850
    },
    {
      page: 5,
      text: `Discussion

These results suggest that AI adoption in software development is accelerating. However, challenges remain in terms of training and implementation costs. Further research is needed to address these limitations.

Conclusion

In conclusion, AI technologies offer significant benefits to software development teams. Organizations should invest in AI training programs to maximize these benefits. Future work should focus on developing more accessible AI tools.`,
      startChar: 850,
      endChar: 1200
    }
  ],
  pageCount: 5,
  language: 'English'
};

function testPageReferenceInclusion(summaryText) {
  console.log('🧪 Testing PDF Summary Page References');
  
  // Check for page reference patterns
  const pageReferenceRegex = /p\.\d+/g;
  const matches = summaryText.match(pageReferenceRegex);
  
  console.log('  - Summary text length:', summaryText.length);
  console.log('  - Page references found:', matches ? matches.length : 0);
  console.log('  - Page references:', matches || 'None');
  
  // Validate that each section has page references
  const sections = [
    '📋 文書概要',
    '🎯 主要ポイント', 
    '💡 詳細解説',
    '🔑 キーワード・用語',
    '📈 実践的価値'
  ];
  
  const sectionResults = sections.map(section => {
    const sectionMatch = summaryText.match(new RegExp(`## ${section}([\\s\\S]*?)(?=## |$)`));
    if (sectionMatch) {
      const sectionText = sectionMatch[1];
      const sectionPageRefs = sectionText.match(pageReferenceRegex);
      return {
        section,
        hasContent: true,
        pageReferences: sectionPageRefs ? sectionPageRefs.length : 0,
        pageRefs: sectionPageRefs || []
      };
    }
    return {
      section,
      hasContent: false,
      pageReferences: 0,
      pageRefs: []
    };
  });
  
  console.log('📊 Section Analysis:');
  sectionResults.forEach(result => {
    const status = result.pageReferences >= 2 ? '✅' : (result.pageReferences >= 1 ? '⚠️' : '❌');
    console.log(`  ${status} ${result.section}: ${result.pageReferences} page refs ${result.pageRefs.join(', ')}`);
  });
  
  // Overall assessment
  const totalPageRefs = sectionResults.reduce((sum, r) => sum + r.pageReferences, 0);
  const sectionsWithRefs = sectionResults.filter(r => r.pageReferences > 0).length;
  const sectionsWithMinRefs = sectionResults.filter(r => r.pageReferences >= 2).length;
  
  console.log('📈 Overall Results:');
  console.log(`  - Total page references: ${totalPageRefs}`);
  console.log(`  - Sections with page refs: ${sectionsWithRefs}/${sections.length}`);
  console.log(`  - Sections with 2+ page refs: ${sectionsWithMinRefs}/${sections.length}`);
  
  const isSuccess = totalPageRefs >= 10 && sectionsWithRefs >= 4;
  console.log(`🎯 Test Result: ${isSuccess ? '✅ PASS' : '❌ FAIL'}`);
  
  return {
    success: isSuccess,
    totalPageRefs,
    sectionsWithRefs,
    sectionsWithMinRefs,
    sections: sectionResults
  };
}

function testPageSegmentGeneration() {
  console.log('🧪 Testing Page Segment Generation');
  
  // Test the page segmentation logic
  const { pageSegments, pageCount } = mockPDFContent;
  
  console.log('  - Total pages:', pageCount);
  console.log('  - Generated segments:', pageSegments.length);
  console.log('  - Non-empty segments:', pageSegments.filter(seg => seg.text.length > 0).length);
  
  pageSegments.forEach(segment => {
    console.log(`  - Page ${segment.page}: ${segment.text.length} chars`);
  });
  
  const hasValidSegments = pageSegments.length === pageCount && 
                          pageSegments.every(seg => seg.text.length > 0);
  
  console.log(`🎯 Segment Test Result: ${hasValidSegments ? '✅ PASS' : '❌ FAIL'}`);
  
  return hasValidSegments;
}

// Example mock summary with page references (what we expect to generate)
const mockSummaryWithPageRefs = `## 📋 文書概要
この文書は、p.1-5にわたるAIソフトウェア開発への応用に関する包括的な分析を提示しています。p.1で研究の目的が説明され、p.2で理論的背景が述べられています。

## 🎯 主要ポイント
- p.1でソフトウェア開発におけるAI応用の包括的分析が提示されています
- p.2でAI技術の過去10年間の進歩が詳述されています
- p.4で開発者の85%がAIツールをワークフローに統合していることが報告されています

## 💡 詳細解説
p.2の背景理論によると、機械学習アルゴリズムは現在、様々な業界の多数のアプリケーションを支えています。p.3の方法論セクションでは、200人のソフトウェア開発者への調査と50の実世界AI実装の分析を含む定量的・定性的アプローチが説明されています。

## 🔑 キーワード・用語
p.2で人工知能、機械学習、深層学習の基本概念が定義されています。p.3で研究プロトコルと実装方法論が詳述されています。

## 📈 実践的価値
p.4の結果によると、パフォーマンス改善は全測定指標で平均40%でした。p.5でAI技術がソフトウェア開発チームに重要な利益をもたらすことが結論されています。`;

// Run tests
console.log('🚀 Starting PDF Page Reference Tests\n');

testPageSegmentGeneration();
console.log('');

testPageReferenceInclusion(mockSummaryWithPageRefs);
console.log('');

console.log('✅ All tests completed. Check the implementation for any issues found above.');