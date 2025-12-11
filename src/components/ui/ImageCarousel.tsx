import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './ImageCarousel.module.css';

interface ImageCarouselProps {
    images: string[];
    alt?: string;
    className?: string;
}

export const ImageCarousel: React.FC<ImageCarouselProps> = ({
    images,
    alt = 'Image',
    className = '',
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Minimum swipe distance for gesture
    const minSwipeDistance = 50;

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
        }
    };

    const handleNext = () => {
        if (currentIndex < images.length - 1) {
            setCurrentIndex((prev) => prev + 1);
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            handleNext();
        } else if (isRightSwipe) {
            handlePrev();
        }
    };

    // Reset to first image when images change
    useEffect(() => {
        setCurrentIndex(0);
    }, [images]);

    // Single image - no carousel needed
    if (images.length <= 1) {
        return (
            <div className={`${styles.container} ${className}`}>
                <img
                    src={images[0] || '/placeholder-menu.png'}
                    alt={alt}
                    className={styles.image}
                    loading="lazy"
                />
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`${styles.container} ${className}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Image Track */}
            <div
                className={styles.track}
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
                {images.map((src, index) => (
                    <div key={index} className={styles.slide}>
                        <img
                            src={src}
                            alt={`${alt} ${index + 1}`}
                            className={styles.image}
                            loading="lazy"
                        />
                    </div>
                ))}
            </div>

            {/* Navigation Arrows - Desktop */}
            <button
                className={`${styles.arrow} ${styles.arrowLeft}`}
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                aria-label="Previous image"
            >
                <ChevronLeft size={20} />
            </button>
            <button
                className={`${styles.arrow} ${styles.arrowRight}`}
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                aria-label="Next image"
            >
                <ChevronRight size={20} />
            </button>
        </div>
    );
};
