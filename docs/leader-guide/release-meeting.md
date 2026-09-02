# Release Note / Whitepaper 회의 운영 방향

현재 개발자 11명, QC 2명, DevOps 1명 규모라면 기존처럼 전체 인원이 참석해 변경사항을 하나씩 공유하는 방식은 비효율적일 가능성이 높다. 특히 파트장이 없는 상황에서는 특정 인원이 업무를 취합해 정리하는 구조보다, **Agent가 초안을 만들고 각 담당자가 검증하는 분산형 운영 방식**이 적합하다.

현재처럼 Agent가 Git 코드와 티켓 시스템 데이터를 기반으로 버전 간 작업 목록을 생성하고, 이를 바탕으로 Feature, Bug Fix, QC 항목, Edge Case, 아키텍처 변경, DDL, 배포 유의사항 등을 정리하는 구조를 중심으로 운영한다.

## 1. 개발자 전원은 사전 검증에 참여

개발자 11명 모두가 회의에 참석하기보다, Agent가 생성한 Release Whitepaper 초안에서 본인이 담당한 항목을 사전에 확인한다.

확인 항목은 다음과 같다.

* 작업 누락 여부
* 실제 릴리즈 포함 여부
* 기존 기능 영향 및 Regression 가능성
* 추가 QC가 필요한 항목
* 아키텍처 또는 API 변경
* DDL 및 Migration 여부
* 설정 및 배포 유의사항

파트장이 별도로 취합하지 않고 **각 Feature 담당자가 자신의 변경사항을 직접 책임지는 구조**로 운영한다.

## 2. Release Whitepaper 회의는 소수 인원 중심

본 회의는 전체 개발자 회의가 아니라 **릴리즈 의사결정 회의**로 정의한다.

기본 참석자는 다음과 같이 구성한다.

* Release Owner 또는 팀장
* 주요 Component Owner 2~3명
* QC 2명
* DevOps 1명
* 필요 시 해당 버전의 고위험 변경 담당자

전체적으로 6~8명 정도가 적절하다.

## 3. 모든 변경사항을 회의에서 검토하지 않는다

Agent가 변경사항을 위험도 기준으로 분류한다.

* Green: 일반 변경, 회의 검토 불필요
* Yellow: 영향도 확인 필요
* Red: 아키텍처, DDL, Breaking Change, 배포 위험 등

예를 들어 전체 변경이 30건이라면 Green 20여 건은 문서로 확인하고, 회의에서는 Yellow와 Red 항목만 집중적으로 검토한다.

## 4. 회의에서 결정할 핵심 영역

회의에서는 다음 네 가지를 확정한다.

1. **Release Scope**

   * 이번 버전에 포함할 기능과 제외할 기능

2. **Risk**

   * 기존 기능 영향, Breaking Change, 아키텍처 변경

3. **QC Scope**

   * Regression, Edge Case, 권한, 동시성, Migration 등 추가 테스트 범위

4. **Deployment**

   * DDL, Config, 배포 순서, 무중단 여부, Rollback 조건

## 5. 조직 규모 확대에 따른 운영 원칙

개발자가 11명 이상이면 개인별 업무 취합보다는 **Component 단위 Ownership**이 적합하다.

예를 들어 Gateway, Workflow, Connector, Admin, Agent 등의 영역별 Owner를 지정하고,

**개발자 → Component Owner → Release Whitepaper**

구조로 운영한다.

Component Owner는 관리자가 아니라 해당 영역의 변경사항과 위험도를 확인하는 기술적 책임자로 정의하면 된다.

결론적으로, 앞으로는 **개발자 전원은 Agent가 생성한 백서를 비동기로 검증하고, 실제 Release Whitepaper 회의는 팀장·Component Owner·QC·DevOps 중심의 소규모 의사결정 회의로 운영하는 방식**이 가장 적절하다.
