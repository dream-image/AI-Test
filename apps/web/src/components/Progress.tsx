import React from 'react';

interface ProgressProps {
    text: string;
    percentage: number;
}

function Progress({ text, percentage }: ProgressProps) {
    const progressPercentage = percentage || 0;

    return (
        <div className="progress-container">
            <div className="progress-info">
                <span className="progress-text">{text}</span>
                <span className="progress-percentage">{progressPercentage.toFixed(1)}%</span>
            </div>
            <div className="progress-bar-bg">
                <div
                    className="progress-bar-fill"
                    style={{ width: `${progressPercentage}%` }}
                />
            </div>
        </div>
    );
}

export default Progress;
