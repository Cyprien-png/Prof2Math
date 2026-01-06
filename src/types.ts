export interface Block {
    id: string;
    markdown: string;
    html: string;
    isEditing: boolean;
    name?: string;
}
