import styles from "./Section.module.scss";

function Section({ title, children }: { title: string, children?: React.ReactNode }) {
    return (
        <div className={styles.container}>
            <div className={styles.sectionTitle}>{title}</div>
            {
                children && <div className={styles.sectionContent}>{children}</div>
            }
        </div>
    );
}

export default Section;
